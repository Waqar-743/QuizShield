// Hosted deadline boundaries. No clock or browser mocking; only QA fixture accounts.
const fs=require('fs'),assert=require('node:assert/strict');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const ids=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json')),path='.vercel/qa-timing-fixtures.json';
const checked=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function api(path,method='GET',body,token){
  const start=Date.now(),r=await fetch(env.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
  const value=await r.json();return {status:r.status,data:value.data,ms:Date.now()-start};
}
async function main(){
 const teacher=await api('/api/auth/login','POST',{email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD});assert.equal(teacher.status,200);const t=teacher.data.token;
 if(process.argv[2]==='prepare'){
  const original=(await api('/api/automations/settings','GET',undefined,t)).data.settings;
  const settings=await api('/api/automations/settings','PUT',{...original,announcement:false,deadline_reminder:false,results_email:false,schedule_email:false,welcome_email:false,calendar_sync:false,sheets_sync:false},t);assert.equal(settings.status,200);
  const f={original,quizzes:[],results:[],verifyAfter:new Date(Date.now()+65000).toISOString()};fs.writeFileSync(path,JSON.stringify(f));
  const login=await api('/api/auth/login','POST',{email:env.AUTOMATION_TEST_RECIPIENTS,password:env.STAGING_TEST_PASSWORD});
  const s=login.data.token;
  for(const short of [false,true]){
   const closesAt=new Date(Date.now()+(short?45000:7200000)).toISOString();
   const q=await api('/api/quizzes','POST',{title:'QA timing '+(short?'closing window':'attempt duration'),courseId:ids.course,scheduledStart:new Date(Date.now()-60000).toISOString(),closesAt,timezone:'Asia/Karachi',timeLimit:1,assignedStudentIds:[ids.student],questions:[{text:'Choose four',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},t);assert.equal(q.status,201);
   const record={id:q.data._id,short,closesAt};f.quizzes.push(record);fs.writeFileSync(path,JSON.stringify(f));
   assert.equal((await api('/api/quizzes/teacher/'+record.id+'/publish','POST',{},t)).status,200);
   const source=checked(await db.from('teacher_quizzes').select('access_code').eq('id',record.id).single());record.code=source.access_code;
   const start=await api('/api/quizzes/start-by-code/'+record.code,'POST',{},s);assert.equal(start.status,200);record.attempt=start.data.attemptId;
   const persisted=checked(await db.from('quiz_attempts').select('started_at,deadline_at').eq('id',record.attempt).single());
   const actual=Date.parse(persisted.deadline_at),expected=Math.min(Date.parse(persisted.started_at)+60000,Date.parse(closesAt));
   f.verifyAfter=new Date(Math.max(Date.parse(f.verifyAfter),actual+5000)).toISOString();
   f.results.push({id:short?'CLOSE-CAPS-DURATION':'DURATION-CAPS-WINDOW',pass:Math.abs(actual-expected)<1000,deadlineAt:persisted.deadline_at,expectedDeadlineAt:new Date(expected).toISOString(),startHttp:start.status});
   const refresh=await api('/api/quizzes/attempt/'+record.attempt+'/results','GET',undefined,s);
   f.results.push({id:'REFRESH-'+(short?'CLOSE':'DURATION'),pass:refresh.status===200&&!JSON.stringify(refresh.data).match(/correctAnswer|correct_answer/),httpStatus:refresh.status});
   fs.writeFileSync(path,JSON.stringify(f));
  }
  console.log(JSON.stringify({phase:'prepared',verifyAfter:f.verifyAfter,results:f.results}));
 }else if(process.argv[2]==='verify'){
  const f=JSON.parse(fs.readFileSync(path));assert.ok(Date.now()>Date.parse(f.verifyAfter),'Wait for the real deadlines');
  const login=await api('/api/auth/login','POST',{email:env.AUTOMATION_TEST_RECIPIENTS,password:env.STAGING_TEST_PASSWORD});
 const s=login.data.token;
  try{
   for(const q of f.quizzes){
    const late=await api('/api/quizzes/'+q.attempt+'/submit-all','POST',{answers:[{questionId:q.id+'-q0',selectedAnswer:0}]},s);
    const a=checked(await db.from('quiz_attempts').select('score,status,answers').eq('id',q.attempt).single());
    f.results.push({id:'EXPIRED-SUBMIT-'+(q.short?'CLOSE':'DURATION'),pass:[403,409].includes(late.status)&&!a.answers?.length&&!a.score,httpStatus:late.status,persistedStatus:a.status,persistedScore:a.score});
   }
  }finally{
   for(const q of f.quizzes){await api('/api/quizzes/teacher/'+q.id+'/cancel','POST',{},t);checked(await db.from('automation_jobs').update({status:'cancelled',last_error:'Timing QA completed'}).eq('quiz_id',q.id).in('status',['pending','running','awaiting','failed']));}
   await api('/api/automations/settings','PUT',f.original,t);
  }
  const report={verifiedAt:new Date().toISOString(),environment:'hosted-staging',cameraAccessRequired:false,realClock:true,results:f.results,cleanup:'Both quizzes cancelled; original automation preferences restored'};
  fs.writeFileSync('../qa/timing-api.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(f.results.some(x=>!x.pass))process.exitCode=1;
 }else throw Error('Choose prepare or verify');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
