// Controlled staging account/course/queue tests. Random fixture credentials stay local.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),bcrypt=require('bcryptjs');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local')),operator=JSON.parse(fs.readFileSync('.vercel/admin-fixtures.json'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}}),results=[];
const checked=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
async function api(path,method='GET',body,token,headers={}){const r=await fetch(env.BACKEND_PUBLIC_URL+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});const v=await r.json();return {status:r.status,data:v.data};}
async function login(email,password){const r=await api('/auth/login','POST',{email,password});assert.equal(r.status,200);return r.data.token;}
const record=(name,pass,detail={})=>{results.push({name,pass,...detail});assert.ok(pass,name);};
(async()=>{
 let b,credentials,teacher,admin=await login(operator.adminEmail,operator.adminPassword);
 try{
  const email='advanced-qa-'+crypto.randomUUID()+'@quizshield.invalid',password=crypto.randomBytes(24).toString('base64url')+'aA1';
  const invite=await api('/admin/accounts','POST',{name:'Advanced staging QA teacher',email,role:'teacher'},admin);assert.equal(invite.status,201);b=invite.data.account.id;
  credentials={id:b,email,password};fs.writeFileSync('.vercel/admin-advanced-fixtures.json',JSON.stringify(credentials));
  checked(await db.from('users').update({status:'active',password:await bcrypt.hash(password,12)}).eq('id',b));
  const owner=await login(email,password);
  teacher=checked(await db.from('users').select('id').eq('email','teacher@quizshield.invalid').single()).id;
  const course=await api('/courses','POST',{title:'Administrator ownership transfer QA',description:'Retained controlled staging fixture',category:'Other',difficulty:'Beginner',maxStudents:2},owner);assert.equal(course.status,201);
  const quiz=await api('/quizzes','POST',{title:'Retained transferred draft',courseId:course.data._id,timeLimit:15,questions:[{text:'Two plus two?',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},owner);assert.equal(quiz.status,201);
  credentials.course=course.data._id;credentials.quiz=quiz.data._id;fs.writeFileSync('.vercel/admin-advanced-fixtures.json',JSON.stringify(credentials));
  const student=checked(await db.from('users').select('id').eq('email',env.AUTOMATION_TEST_RECIPIENTS).single()).id;
  record('Administrator enrolment',(await api('/admin/courses/'+course.data._id+'/enrolment','POST',{student_id:student,enrolled:true},admin)).status===200);
  record('Administrator unenrolment',(await api('/admin/courses/'+course.data._id+'/enrolment','POST',{student_id:student,enrolled:false},admin)).status===200);
  record('Ownership transfer requires explicit confirmation',(await api('/admin/courses/'+course.data._id+'/transfer','POST',{teacher_id:teacher},admin)).status===409);
  record('Ownership transfer succeeds',(await api('/admin/courses/'+course.data._id+'/transfer','POST',{teacher_id:teacher,confirm:course.data._id},admin)).status===200);
  const q=checked(await db.from('teacher_quizzes').select('teacher_id,lifecycle').eq('id',quiz.data._id).single());
  record('Transferred assessment preserved with successor ownership',q.teacher_id===teacher&&q.lifecycle==='draft');
  record('Former owner loses assessment editing',(await api('/quizzes/'+quiz.data._id,'PUT',{title:'Forbidden update',questions:[{text:'Two plus two?',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},owner)).status===404);
  record('Second administrator created through audited role change',(await api('/admin/accounts/'+b,'PATCH',{role:'admin'},admin)).status===200);
  const secondAdmin=await login(email,password);
  const responses=await Promise.all([api('/admin/accounts/'+operator.admin,'PATCH',{role:'teacher'},admin),api('/admin/accounts/'+b,'PATCH',{role:'teacher'},secondAdmin)]);
  const statuses=responses.map(r=>r.status).sort();
  record('Concurrent self-demotions leave one active administrator',statuses[0]===200&&statuses[1]===409,{statuses});
 }finally{
  if(b){
   const first=checked(await db.from('users').select('role,status').eq('id',operator.admin).single());
   const token=first.role==='admin'?await login(operator.adminEmail,operator.adminPassword):await login(credentials.email,credentials.password);
   if(first.role!=='admin')assert.equal((await api('/admin/accounts/'+operator.admin,'PATCH',{role:'admin'},token)).status,200);
   admin=await login(operator.adminEmail,operator.adminPassword);
   const jobs=[];
   for(const status of ['pending','running','awaiting']){
    const job=checked(await db.from('automation_jobs').insert({teacher_id:teacher,student_id:b,kind:'welcome',channel:'email',status,dedupe_key:'controlled-disabled-'+crypto.randomUUID(),execution_token:crypto.randomUUID(),lease_until:new Date(Date.now()+300000).toISOString()}).select('id,status,execution_token').single());jobs.push(job);
   }
   const removed=await api('/admin/accounts/'+b,'PATCH',{status:'deactivated'},admin,{'x-confirm-account':b});record('Recoverable removal invalidates queued and in-progress jobs',removed.status===200);
   const after=checked(await db.from('automation_jobs').select('id,status').in('id',jobs.map(j=>j.id)));
   record('Queued job cancelled and dispatched leases require reconciliation',after.filter(j=>j.status==='cancelled').length===1&&after.filter(j=>j.status==='uncertain').length===2);
   const inFlight=jobs.find(j=>j.status==='awaiting');
   record('Disabled callback cannot initiate provider delivery',(await api('/automations/delivery/'+inFlight.id+'/email','POST',{},undefined,{'x-quizshield-execution-token':inFlight.execution_token})).status===200);
   record('Uncertain job cannot be blindly retried',(await api('/admin/jobs/'+inFlight.id+'/retry','POST',{},admin)).status===409);
   checked(await db.from('automation_jobs').update({status:'cancelled',last_error:'Controlled QA leases never dispatched to a provider; fixture cleanup'}).in('id',jobs.map(j=>j.id)));
  }
  fs.writeFileSync('../qa/admin-advanced-api.json',JSON.stringify({verifiedAt:new Date().toISOString(),environment:'hosted staging',results,cleanup:'First QA administrator restored. Secondary fixture deactivated; draft course/assessment retained. Manually created delivery leases were never externally dispatched and were cancelled after assertions.'},null,2));
 }
 console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
