// Camera-free browser assessment, with external jobs explicitly cancelled.
const fs=require('fs'),assert=require('assert/strict');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local')),f=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
async function api(path,body,token){const r=await fetch(env.BACKEND_PUBLIC_URL+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const v=await r.json();assert.ok(r.ok,path+':'+r.status);return v.data;}
(async()=>{
 const original=check(await db.from('automation_settings').select('*').eq('teacher_id',f.teacher).single());
 const t=(await api('/auth/login',{email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD})).token;
 let fixture=fs.existsSync('.vercel/admin-browser-fixture.json')?JSON.parse(fs.readFileSync('.vercel/admin-browser-fixture.json')):{};
 try{
  check(await db.from('automation_settings').update({announcement:false,deadline_reminder:false,results_email:false,schedule_email:false,welcome_email:false,calendar_sync:false,sheets_sync:false}).eq('teacher_id',f.teacher));
  if(process.argv[2]==='create'){
   const q=await api('/quizzes',{title:'Camera-free browser acceptance',courseId:f.course,timeLimit:15,scheduledStart:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timezone:'Asia/Karachi',assignedStudentIds:[f.student],questions:[{text:'What is 2 + 2?',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},t);
   fixture={quiz:q._id};await api('/quizzes/teacher/'+q._id+'/publish',{},t);
   fixture.code=check(await db.from('teacher_quizzes').select('access_code').eq('id',q._id).single()).access_code;
   fs.writeFileSync('.vercel/admin-browser-fixture.json',JSON.stringify(fixture));
  }else{
   await api('/quizzes/teacher/'+fixture.quiz+'/cancel',{},t);
  }
  check(await db.from('automation_jobs').update({status:'cancelled',last_error:'Controlled browser-only acceptance; no external delivery requested'}).eq('quiz_id',fixture.quiz).in('status',['pending','failed']));
 }finally{check(await db.from('automation_settings').upsert(original));}
 console.log(JSON.stringify({quiz:fixture.quiz,externalDelivery:false,phase:process.argv[2]}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
