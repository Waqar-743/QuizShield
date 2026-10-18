import {test} from 'node:test';
import assert from 'node:assert/strict';
import google,{runGoogleDelivery,validateGoogleInput} from './quizshield-google.mjs';
const base='https://staging.example.test/api/automations/delivery',job='11111111-1111-4111-8111-111111111111';
const headers={'x-end-org-id':'tenant','x-installation-id':'inst_123'};
const input={channel:'fastn',kind:'calendar',tenantId:'tenant',installationId:'inst_123',executionToken:'short-lived-test',preflightUrl:`${base}/${job}/preflight`,completeUrl:`${base}/${job}/complete`};
const calendar={tenantId:'tenant',installationId:'inst_123',calendarId:'owned',eventId:'a'.repeat(64),revision:2,operation:'upsert',summary:'Assessment',start:{dateTime:'2026-10-25T10:00:00+05:00',timeZone:'Asia/Karachi'},end:{dateTime:'2026-10-25T11:00:00+05:00',timeZone:'Asia/Karachi'}};
function harness(kind='calendar',payload=calendar){
  const writes=[],completed=[];let checks=0;
  const runtime={request:async(url,body)=>{if(url===input.completeUrl){completed.push(body);return {success:true};}checks++;return {channel:'fastn',kind,payload};},
    ownCalendar:async id=>assert.equal(id,'owned'),sheetExists:async()=>{},
    calendar:async(op,p)=>{writes.push([op,p]);return op==='get'?{status:404}:{status:200,body:{id:p.eventId,status:'confirmed'}};},
    sheets:async p=>{writes.push(['sheets',p]);return {status:200,body:{updatedRange:p.range,updatedRows:1,updatedCells:6}};}};
  return {runtime,writes,completed,get checks(){return checks;}};
}
test('tenant and installation context and callback origin are required before external calls',()=>{
  validateGoogleInput(base,input,headers);
  for(const h of [{},{...headers,'x-end-org-id':'other'},{...headers,'x-installation-id':'inst_other'}])assert.throws(()=>validateGoogleInput(base,input,h),/context/);
  assert.throws(()=>validateGoogleInput(base,{...input,channel:'email'},headers),/Google-only/);
  assert.throws(()=>validateGoogleInput(base,{...input,executionToken:''},headers),/token/);
  assert.throws(()=>validateGoogleInput(base,{...input,completeUrl:'https://attacker.example.test'},headers),/callback URL/);
});
test('create keeps ID, timezone, revision and explicit no-attendee reminder policy',async()=>{
  const h=harness();const r=await runGoogleDelivery(input,h.runtime),p=h.writes[1][1];
  assert.equal(r.providerId,calendar.eventId);assert.equal(p.resource.id,calendar.eventId);
  assert.deepEqual(p.resource.start,calendar.start);assert.deepEqual(p.resource.end,calendar.end);
  assert.deepEqual(p.resource.attendees,[]);assert.deepEqual(p.resource.reminders,{useDefault:false});
  assert.deepEqual(p.resource.extendedProperties,{private:{quizshieldRevision:'2'}});assert.equal(h.completed.length,1);
});
test('existing event updates the same ID',async()=>{
  const h=harness();h.runtime.calendar=async(op,p)=>{h.writes.push([op,p]);return {status:200,body:{id:p.eventId,status:'confirmed'}};};
  await runGoogleDelivery(input,h.runtime);assert.deepEqual(h.writes.map(x=>x[0]),['get','update']);
});
test('concurrent duplicate insert becomes same-ID update',async()=>{
  const h=harness();h.runtime.calendar=async(op,p)=>{h.writes.push([op,p]);return op==='get'?{status:404}:op==='insert'?{status:409}:{status:200,body:{id:p.eventId}};};
  await runGoogleDelivery(input,h.runtime);assert.deepEqual(h.writes.map(x=>x[0]),['get','insert','update']);
});
test('cancel removes an existing event and missing or cancelled events are idempotent',async()=>{
  for(const found of [{status:200,body:{status:'confirmed'}},{status:200,body:{status:'cancelled'}},{status:404},{status:410}]){
    const h=harness('calendar',{...calendar,operation:'cancel'});
    h.runtime.calendar=async(op,p)=>{h.writes.push([op,p]);return op==='get'?found:{status:204};};
    await runGoogleDelivery(input,h.runtime);
    assert.equal(h.writes.length,found.status===200 && found.body.status==='confirmed'?2:1);assert.equal(h.completed[0].providerId,calendar.eventId);
  }
});
test('a calendar not owned by the teacher fails before event lookup or write',async()=>{
  const h=harness();h.runtime.ownCalendar=async()=>{throw Error('not owned');};
  await assert.rejects(runGoogleDelivery(input,h.runtime),/not owned/);assert.equal(h.writes.length,0);assert.equal(h.completed.length,0);
});
test('stale revision and withdrawn eligibility prevent a write after the connector read',async()=>{
  for(const changed of [{channel:'fastn',kind:'calendar',payload:{...calendar,revision:3}},{skipped:true}]){
    const h=harness();let n=0;h.runtime.request=async()=>++n===1?{channel:'fastn',kind:'calendar',payload:calendar}:changed;
    if(changed.skipped)assert.deepEqual(await runGoogleDelivery(input,h.runtime),{skipped:true});else await assert.rejects(runGoogleDelivery(input,h.runtime),/revision/);
    assert.deepEqual(h.writes.map(x=>x[0]),['get']);
  }
});
test('replay of a completed job makes no connector calls',async()=>{
  const h=harness();h.runtime.request=async()=>({alreadyCompleted:true});assert.deepEqual(await runGoogleDelivery(input,h.runtime),{skipped:true});assert.equal(h.writes.length,0);
});
test('a changed teacher binding is rejected before any connector call',async()=>{
  const h=harness('calendar',{...calendar,tenantId:'other'});await assert.rejects(runGoogleDelivery(input,h.runtime),/binding changed/);assert.equal(h.writes.length,0);
});
const sheet={tenantId:'tenant',installationId:'inst_123',spreadsheetId:'owned-sheet',range:"'Results'!A2:F2",values:[['attempt','Quiz','Student','=1+1',87,'released']]};
test('Sheets replay targets the same reserved row and requires a six-cell provider receipt',async()=>{
  const h=harness('sheets',sheet),i={...input,kind:'sheets'};
  const a=await runGoogleDelivery(i,h.runtime),b=await runGoogleDelivery(i,h.runtime);
  assert.equal(a.providerId,b.providerId);assert.deepEqual(h.writes.map(x=>x[1].range),[sheet.range,sheet.range]);
  h.runtime.sheets=async()=>({status:200,body:{updatedRange:sheet.range,updatedRows:1,updatedCells:5}});
  await assert.rejects(runGoogleDelivery(i,h.runtime),/receipt/);assert.equal(h.completed.length,2);
});
test('a changed Sheet range is rejected before the update',async()=>{
  const h=harness('sheets',sheet);let n=0;h.runtime.request=async()=>({channel:'fastn',kind:'sheets',payload:++n===1?sheet:{...sheet,range:'A3:F3'}});
  await assert.rejects(runGoogleDelivery({...input,kind:'sheets'},h.runtime),/destination changed/);assert.equal(h.writes.length,0);
});
test('SDK adapter unwraps output, recognizes 404, and forces RAW regardless of payload',async()=>{
  const oldFastn=globalThis.fastn,oldClient=globalThis.Fastn,oldFetch=globalThis.fetch;const calls=[];
  const wrap=output=>({success:true,status:200,output});
  globalThis.fastn={envConfig:{get:async()=>base}};
  globalThis.Fastn=class{constructor(){this.connector={quizshieldGoogleCalendar:{
    listOwnedCalendars:async()=>wrap({items:[{id:'owned',accessRole:'owner'}]}),
    getAssessmentEvent:async()=>{throw Object.assign(Error('Not Found'),{statusCode:404});},
    createAssessmentEvent:async p=>{calls.push(p);return wrap({id:p.resource.id,status:'confirmed'});},
  },googleSheets:{getSpreadsheet:async()=>wrap({spreadsheetId:'owned-sheet'}),updateValues:async p=>{calls.push(p);return wrap({updatedRange:p.range,updatedRows:1,updatedCells:6});}}};}};
  try{
    for(const [kind,payload] of [['calendar',calendar],['sheets',{...sheet,valueInputOption:'USER_ENTERED'}]]){
      globalThis.fetch=async(url,options)=>({ok:true,json:async()=>url.endsWith('/complete')?{success:true}:{channel:'fastn',kind,payload}});
      await google({input:{...input,kind},headers});
    }
    assert.equal(calls[1].valueInputOption,'RAW');assert.deepEqual(calls[1].values,sheet.values);
  }finally{globalThis.fastn=oldFastn;globalThis.Fastn=oldClient;globalThis.fetch=oldFetch;}
});
