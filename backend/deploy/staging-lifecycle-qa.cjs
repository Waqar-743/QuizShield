// Real hosted API lifecycle checks with synthetic QA accounts only.
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const e=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(e.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(e.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(e.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db=require('@supabase/supabase-js').createClient(e.SUPABASE_URL,e.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const f=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json')),results=[],ids={};
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function call(path,method='GET',body,token){const start=Date.now();const r=await fetch(e.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});const v=await r.json();return {status:r.status,data:v.data,value:v,ms:Date.now()-start};}
function row(id,pass,evidence){results.push({id,pass,...evidence});}
async function main(){
 const login=await call('/api/auth/login','POST',{email:'teacher@quizshield.invalid',password:e.STAGING_TEST_PASSWORD});assert.equal(login.status,200);const t=login.data.token;
 const u=check(await db.from('users').select('email').eq('id',f.student).single());
 const sl=await call('/api/auth/login','POST',{email:u.email,password:e.STAGING_TEST_PASSWORD});
 assert.equal(sl.status,200);const s=sl.data.token;
 const original=(await call('/api/automations/settings','GET',undefined,t)).data.settings;
 try{
  const muted=await call('/api/automations/settings','PUT',{...original,announcement:false,deadline_reminder:false,results_email:false,schedule_email:false,welcome_email:false,calendar_sync:false,sheets_sync:false},t);assert.equal(muted.status,200);
  const c=await call('/api/courses','POST',{title:'QA lifecycle '+new Date().toISOString(),description:'Controlled staging QA fixture',category:'Other',difficulty:'Beginner',maxStudents:3},t);row('COURSE-CREATE',c.status===201,{status:c.status});assert.equal(c.status,201);ids.course=c.data._id;const code=c.data.courseCode;
  row('COURSE-CODE',typeof code==='string'&&code.length===6,{length:code?.length});
  const catalog=await call('/api/courses');row('CATALOG-PRIVACY',catalog.status===200&&!catalog.data.some(x=>x.course_code||x.courseCode),{status:catalog.status});
  const joined=await call('/api/courses/join-by-code','POST',{courseCode:code},s);const repeated=await call('/api/courses/join-by-code','POST',{courseCode:code},s);
  row('COURSE-ENROL-REPLAY',joined.status===200&&repeated.status===200&&check(await db.from('enrollments').select('id').eq('user_id',f.student).eq('course_id',ids.course)).length===1,{statuses:[joined.status,repeated.status]});
  const draft={title:'QA lifecycle assessment',courseId:ids.course,scheduledStart:new Date(Date.now()+600000).toISOString(),closesAt:new Date(Date.now()+7200000).toISOString(),timezone:'Asia/Karachi',timeLimit:15,assignedStudentIds:[f.student],questions:[{text:'Choose four',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]};
  const q=await call('/api/quizzes','POST',draft,t);assert.equal(q.status,201);ids.quiz=q.data._id;
  const source=check(await db.from('teacher_quizzes').select('*').eq('id',ids.quiz).single());
  const draftJobs=check(await db.from('automation_jobs').select('id').eq('quiz_id',ids.quiz));row('DRAFT-SILENCE',draftJobs.length===0,{jobs:draftJobs.length});
  const draftAccess=await call('/api/quizzes/access-by-code/'+source.access_code,'GET',undefined,s);row('DRAFT-ACCESS',draftAccess.status>=400&&draftAccess.status<500,{status:draftAccess.status});
  const pub1=await call('/api/quizzes/teacher/'+ids.quiz+'/publish','POST',{},t),pub2=await call('/api/quizzes/teacher/'+ids.quiz+'/publish','POST',{},t);
  const announcements=check(await db.from('automation_jobs').select('id').eq('quiz_id',ids.quiz).eq('kind','announcement').eq('channel','email'));row('PUBLISH-ONCE',pub1.status===200&&pub2.status===200&&announcements.length===1,{statuses:[pub1.status,pub2.status],emailJobs:announcements.length});
  const early=await call('/api/quizzes/start-by-code/'+source.access_code,'POST',{},s);row('EARLY-START',early.status>=400&&early.status<500,{status:early.status});
  const changed={...draft,scheduledStart:new Date(Date.now()-60000).toISOString()};const update=await call('/api/quizzes/'+ids.quiz,'PUT',changed,t);assert.equal(update.status,200);
  const starts=await Promise.all([call('/api/quizzes/start-by-code/'+source.access_code,'POST',{},s),call('/api/quizzes/start-by-code/'+source.access_code,'POST',{},s)]);
  ids.attempt=starts[0].data?.attemptId;assert.ok(ids.attempt);row('CONCURRENT-START',starts.every(x=>x.status===200&&x.data.attemptId===ids.attempt),{statuses:starts.map(x=>x.status),uniqueAttemptIds:new Set(starts.map(x=>x.data?.attemptId)).size});
  const answer={questionId:ids.quiz+'-q0',selectedAnswer:0};
  const duplicate=await call('/api/quizzes/'+ids.attempt+'/submit-all','POST',{answers:[answer,answer]},s);row('DUPLICATE-ANSWERS',duplicate.status===400,{status:duplicate.status});
  const submitted=await call('/api/quizzes/'+ids.attempt+'/submit-all','POST',{answers:[answer]},s);assert.equal(submitted.status,200);
  const repeatedSubmit=await call('/api/quizzes/'+ids.attempt+'/submit-all','POST',{answers:[{...answer,selectedAnswer:1}]},s);
  const stored=check(await db.from('quiz_attempts').select('score,answers').eq('id',ids.attempt).single());row('SUBMIT-IMMUTABLE',repeatedSubmit.status>=400&&repeatedSubmit.status<500&&stored.score===1,{status:repeatedSubmit.status,persistedScore:stored.score});
  const grade=await call('/api/quizzes/submissions/'+ids.attempt+'/grade','PUT',{grade:82,feedback:'Private QA review'},t);assert.equal(grade.status,200);
  const before=await call('/api/quizzes/attempt/'+ids.attempt+'/results','GET',undefined,s);row('PRIVATE-REVIEW',before.status===200&&before.data.teacherGrade==null&&!before.data.teacherFeedback,{status:before.status,gradeVisible:before.data?.teacherGrade!=null});
  const release=await call('/api/quizzes/submissions/'+ids.attempt+'/release','POST',{},t);const releaseAgain=await call('/api/quizzes/submissions/'+ids.attempt+'/release','POST',{},t);
  const after=await call('/api/quizzes/attempt/'+ids.attempt+'/results','GET',undefined,s);row('RELEASE-ONCE',release.status===200&&releaseAgain.status===200&&after.data.teacherGrade===82,{statuses:[release.status,releaseAgain.status],releasedGrade:after.data?.teacherGrade});
  const editReleased=await call('/api/quizzes/submissions/'+ids.attempt+'/grade','PUT',{grade:90,feedback:'Should fail'},t);row('RELEASE-IMMUTABLE',editReleased.status===409,{status:editReleased.status});
  const role=await call('/api/auth/switch-role','PUT',{role:'teacher'},s);row('ROLE-ESCALATION',role.status===404,{status:role.status});
  const otherPassword='Qa9'+crypto.randomBytes(18).toString('hex');const newEmail='qa-owner-'+crypto.randomUUID()+'@quizshield.invalid';const reg=await call('/api/auth/register','POST',{name:'QA other teacher',email:newEmail,password:otherPassword,role:'teacher'});assert.equal(reg.status,201);ids.otherTeacher=reg.data.user._id;
  const foreign=await call('/api/auth/login','POST',{email:newEmail,password:otherPassword});const o=foreign.data.token;
  const other=await call('/api/automations/courses/'+ids.course+'/students','GET',undefined,o);row('ROSTER-OWNERSHIP',[403,404].includes(other.status)&&other.data===undefined,{status:other.status,existenceConcealed:other.status===404});
  const foreignGrade=await call('/api/quizzes/submissions/'+ids.attempt+'/grade','PUT',{grade:10,feedback:'Should fail'},o);row('GRADE-OWNERSHIP',foreignGrade.status===403,{status:foreignGrade.status});
  const foreignResult=await call('/api/quizzes/attempt/'+ids.attempt+'/results','GET',undefined,o);row('RESULT-OWNERSHIP',foreignResult.status===403,{status:foreignResult.status});
  const cancel=await call('/api/quizzes/teacher/'+ids.quiz+'/cancel','POST',{},t);row('CANCELLATION',cancel.status===200,{status:cancel.status});
  const cancelled=await call('/api/quizzes/start-by-code/'+source.access_code,'POST',{},s);row('CANCELLED-START',cancelled.status>=400&&cancelled.status<500,{status:cancelled.status});
 }finally{
  if(ids.quiz)await call('/api/quizzes/teacher/'+ids.quiz+'/cancel','POST',{},t);
  await call('/api/automations/settings','PUT',original,t);
  if(ids.quiz)check(await db.from('automation_jobs').update({status:'cancelled',last_error:'Controlled QA cleanup; no external delivery requested'}).eq('quiz_id',ids.quiz).in('status',['pending','running','awaiting','failed']));
  fs.writeFileSync('.vercel/qa-fixtures.json',JSON.stringify(ids,null,2));
  fs.writeFileSync('../qa/lifecycle-api.json',JSON.stringify({verifiedAt:new Date().toISOString(),environment:'hosted-staging',cameraAccessRequired:false,externalDeliveryDuringTest:false,fixtures:ids,results},null,2)+'\n');
  console.log(JSON.stringify({fixtures:ids,results},null,2));
 }
}
main().catch(x=>{console.error(x.message);process.exitCode=1;});
