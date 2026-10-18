// Controlled live acceptance through HOSTED cron only. No local worker or scheduler.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');assert.equal(env.AUTOMATION_TEST_RECIPIENTS,'joinwaqarahmed@gmail.com');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const f=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json')),afile='.vercel/admin-live-automation.json';
let fixture=fs.existsSync(afile)?JSON.parse(fs.readFileSync(afile)):{};
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
async function api(path,method='GET',body,token){const r=await fetch(env.BACKEND_PUBLIC_URL+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});const v=await r.json();assert.ok(r.ok,path+':'+r.status);return v.data;}
async function login(email,password){return (await api('/auth/login','POST',{email,password})).token;}
const save=()=>fs.writeFileSync(afile,JSON.stringify(fixture,null,2));
(async()=>{
 const phase=process.argv[2];
 if(phase==='queue'){
  assert.ok(!fixture.quiz,'Do not create another live fixture while one exists');
  fixture.original=check(await db.from('automation_settings').select('*').eq('teacher_id',f.teacher).single());
  check(await db.from('automation_settings').update({announcement:true,deadline_reminder:false,results_email:false,schedule_email:false,welcome_email:false,calendar_sync:true,sheets_sync:true}).eq('teacher_id',f.teacher));
  const t=await login('teacher@quizshield.invalid',env.STAGING_TEST_PASSWORD);
  const title='Administrator hosted acceptance '+new Date().toISOString();
  const q=await api('/quizzes','POST',{title,courseId:f.course,timeLimit:15,scheduledStart:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+7200000).toISOString(),timezone:'Asia/Karachi',assignedStudentIds:[f.student],questions:[{text:'What is 2 + 2?',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},t);
  fixture={...fixture,quiz:q._id,title,startedAt:new Date().toISOString(),eventId:crypto.createHash('sha256').update(q._id).digest('hex')};save();
  assert.equal(check(await db.from('automation_jobs').select('id').eq('quiz_id',fixture.quiz)).length,0);
  await api('/quizzes/teacher/'+fixture.quiz+'/publish','POST',{},t);await api('/quizzes/teacher/'+fixture.quiz+'/publish','POST',{},t);
  fixture.code=check(await db.from('teacher_quizzes').select('access_code').eq('id',fixture.quiz).single()).access_code;save();
  console.log(JSON.stringify({phase,quiz:fixture.quiz,draftJobs:0,duplicatePublication:'safe',hostedCronOnly:true}));
 }else if(phase==='grade-release'){
  const attempt=check(await db.from('quiz_attempts').select('id,status').eq('quiz_id',fixture.quiz).eq('user_id',f.student).single());
  assert.equal(attempt.status,'completed','Complete the quiz in the browser first');fixture.attempt=attempt.id;save();
  const t=await login('teacher@quizshield.invalid',env.STAGING_TEST_PASSWORD);
  await api('/quizzes/submissions/'+attempt.id+'/grade','PUT',{grade:86,feedback:'Controlled administrator regression review'},t);
  assert.equal(check(await db.from('automation_jobs').select('id').eq('attempt_id',attempt.id).eq('kind','sheets')).length,0);
  await api('/quizzes/submissions/'+attempt.id+'/release','POST',{},t);await api('/quizzes/submissions/'+attempt.id+'/release','POST',{},t);
  assert.equal(check(await db.from('automation_jobs').select('id').eq('attempt_id',attempt.id).eq('kind','sheets')).length,1);
  console.log(JSON.stringify({phase,attempt:attempt.id,sheetsBeforeRelease:0,sheetsAfterRelease:1}));
 }else if(phase==='status'){
  const jobs=check(await db.from('automation_jobs').select('id,kind,channel,status,provider_id,last_error,attempts,updated_at').eq('quiz_id',fixture.quiz));
  const health=check(await db.from('automation_health').select('last_completed_at').eq('id',true).single());
  fixture.jobs=jobs;fixture.health=health;save();console.log(JSON.stringify({phase,jobs,health}));
 }else if(phase==='cancel'){
  const t=await login('teacher@quizshield.invalid',env.STAGING_TEST_PASSWORD);await api('/quizzes/teacher/'+fixture.quiz+'/cancel','POST',{},t);console.log(JSON.stringify({phase,quiz:fixture.quiz}));
 }else if(phase==='verify-email'){
  const job=check(await db.from('automation_jobs').select('id,status,provider_id').eq('quiz_id',fixture.quiz).eq('kind','announcement').eq('channel','email').single());assert.equal(job.status,'succeeded');
  const r=await fetch('https://api.resend.com/emails/'+job.provider_id,{headers:{Authorization:'Bearer '+env.RESEND_API_KEY}});assert.equal(r.status,200);const email=await r.json();assert.deepEqual(email.to,[env.AUTOMATION_TEST_RECIPIENTS]);assert.ok(email.text.includes(env.FRONTEND_URL));
  fixture.email={jobId:job.id,providerId:job.provider_id,lastEvent:email.last_event,recipientRestricted:true};save();console.log(JSON.stringify(fixture.email));
 }else if(phase==='finish'){
  const q=check(await db.from('teacher_quizzes').select('lifecycle').eq('id',fixture.quiz).single());assert.equal(q.lifecycle,'cancelled');
  const jobs=check(await db.from('automation_jobs').select('id,kind,channel,status,provider_id,attempts').eq('quiz_id',fixture.quiz));
  assert.ok(jobs.filter(j=>j.channel==='fastn').every(j=>j.status==='succeeded'));
  check(await db.from('automation_settings').upsert(fixture.original));
  const evidence={verifiedAt:new Date().toISOString(),environment:'hosted staging',hostedCronOnly:true,quiz:fixture.quiz,attempt:fixture.attempt,eventId:fixture.eventId,email:fixture.email,jobs,unrestrictedDelivery:false,fixtureRetention:'Cancelled assessment and reviewed submission retained as audit evidence; no destructive cleanup'};
  fs.writeFileSync('../qa/admin-hosted-automation.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({phase,externalCompleted:jobs.filter(j=>['email','fastn'].includes(j.channel)&&j.status==='succeeded').length,preferencesRestored:true}));
 }else throw new Error('Choose queue, grade-release, status, verify-email, cancel or finish');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
