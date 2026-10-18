const mockTables:Record<string,any[]>={};
function mockQuery(table:string){
 const predicates:((r:any)=>boolean)[]=[];let one=false,patch:any,insert:any;
 const q:any={select:()=>q,eq:(k:string,v:any)=>{predicates.push(r=>r[k]===v);return q;},in:(k:string,v:any[])=>{predicates.push(r=>v.includes(r[k]));return q;},maybeSingle:()=>{one=true;return q;},update:(v:any)=>{patch=v;return q;},upsert:(v:any)=>{insert=v;return q;},insert:(v:any)=>{insert=v;return q;},
 then:(resolve:any,reject:any)=>{mockTables[table]||=[];let rows=mockTables[table].filter(r=>predicates.every(p=>p(r)));if(patch)rows.forEach(r=>Object.assign(r,patch));if(insert){const row=mockTables[table].find(r=>insert.teacher_id&&r.teacher_id===insert.teacher_id);if(row)Object.assign(row,insert);else mockTables[table].push(insert);}return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve,reject);}};return q;
}
jest.mock('../config/supabase',()=>({supabase:{from:(t:string)=>mockQuery(t)}}));
jest.mock('../config/environment',()=>({config:{automationRecipients:[]}}));
jest.mock('../services/emailService',()=>({emailService:{}}));
import { createGoogleSetup,refreshGoogleSetup,connectionView } from '../services/googleSetupService';
const originalFetch=global.fetch;
beforeEach(()=>{
 Object.keys(mockTables).forEach(k=>delete mockTables[k]);
 Object.assign(mockTables,{users:[{id:'teacher',role:'teacher',status:'active',name:'Teacher'}],automation_grants:[{teacher_id:'teacher',status:'active',capabilities:['calendar_sync']}],automation_connections:[{teacher_id:'teacher',tenant_id:'own-tenant',verified_at:'2026-10-18',installation_id:'inst_owned',google_webhook_url:'private-callback',calendar_connected:true,verified_calendar_id:'approved-calendar'}]});
 process.env.FASTN_PLATFORM_API_KEY='controlled-test-key';process.env.FASTN_GOOGLE_WIDGET_ID='wgt_controlled';
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({data:{setupId:'stp_owned',setupUrl:'https://connect.fastn.dev/setup/controlled',status:'pending',endOrgId:'own-tenant',expiresAt:'2026-10-18T23:00:00Z'}})}) as any);
});
afterEach(()=>{global.fetch=originalFetch;delete process.env.FASTN_PLATFORM_API_KEY;delete process.env.FASTN_GOOGLE_WIDGET_ID;});
test('setup accepts the real setupId/setupUrl contract and scopes the link to the teacher',async()=>{
 const result=await createGoogleSetup('teacher','operator');expect(result.status).toBe('authorizing');expect(result.url).toContain('fastn.dev');
 const body=JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
 expect(body).toMatchObject({endOrgId:'own-tenant',metadata:{teacherId:'teacher'},allowAdditionalConnection:true});
 expect(mockTables.google_setup_requests[0].setup_id).toBe('stp_owned');
 expect((await connectionView('teacher')).calendar_connected).toBe(false);
});
test('new teachers use a stable teacher reference instead of another teacher’s tenant',async()=>{
 mockTables.automation_connections=[];await createGoogleSetup('teacher','operator');
 const body=JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);expect(body.externalRef).toBe('quizshield:teacher');expect(body).not.toHaveProperty('endOrgId');
});
test('missing server configuration and provider failures remain blocked',async()=>{
 delete process.env.FASTN_PLATFORM_API_KEY;
 expect((await createGoogleSetup('teacher','operator')).status).toBe('blocked');
 expect(fetch).not.toHaveBeenCalled();
});
test('unassigned or suspended teachers cannot generate a link',async()=>{
 mockTables.users[0].status='suspended';await expect(createGoogleSetup('teacher','operator')).rejects.toMatchObject({statusCode:409});expect(fetch).not.toHaveBeenCalled();
});
test('verification rejects a setup resource belonging to another teacher',async()=>{
 mockTables.google_setup_requests=[{teacher_id:'teacher',setup_id:'stp_owned',tenant_id:'own-tenant'}];
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({data:{status:'completed',metadata:{teacherId:'other'},endOrgId:'own-tenant'}})}) as any);
 await expect(refreshGoogleSetup('teacher','operator')).rejects.toMatchObject({statusCode:403});
});
test('completed OAuth without a verified route never becomes connected',async()=>{
 mockTables.automation_connections=[];mockTables.google_setup_requests=[{teacher_id:'teacher',setup_id:'stp_owned',tenant_id:'own-tenant'}];
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({data:{status:'completed',metadata:{teacherId:'teacher'},endOrgId:'own-tenant'}})}) as any);
 expect((await refreshGoogleSetup('teacher','operator')).status).toBe('blocked');
 expect((await connectionView('teacher')).calendar_connected).toBe(false);
});
