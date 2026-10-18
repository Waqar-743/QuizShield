// Controlled hosted QA only. Never emit tokens, passwords, descriptors or response bodies.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const env = require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL, 'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL, 'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS, 'false');
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const ids = JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json'));
const rows = [];
const check = r => { if (r.error) throw Error(r.error.message); return r.data; };
async function api(path, method='GET', body, token) {
  const start = Date.now();
  const res = await fetch(env.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let value; try { value=await res.json(); } catch { value={}; }
  return {status:res.status,data:value.data,value,ms:Date.now()-start};
}
function record(id, expected, actual, pass, evidence={}) { rows.push({id,expected,actual,pass,...evidence}); }
async function main() {
  const teacher = await api('/api/auth/login','POST',{email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD});
  assert.equal(teacher.status,200); assert.ok(teacher.data.token);
  const token=teacher.data.token;
  const profile=check(await db.from('users').select('name,bio,interests').eq('id',ids.student).single());
  const own=await api('/api/auth/profile','PUT',{name:teacher.data.user.name},token);
  const sensitive=['password','face_encoding','reset_password_token','reset_password_expires_at'].filter(k=>Object.hasOwn(own.data||{},k));
  record('QA-PRIVACY-PROFILE','200 and no authentication or biometric fields',sensitive,own.status===200&&sensitive.length===0,{httpStatus:own.status});
  const student=await api('/api/auth/login','POST',{email:check(await db.from('users').select('email').eq('id',ids.student).single()).email,password:env.STAGING_TEST_PASSWORD});
  assert.equal(student.status,200);const studentToken=student.data.token;assert.ok(studentToken);
  record('QA-PASSWORD-LOGIN','200 session without biometric requirements',student.status,Boolean(studentToken));
  const authless=await api('/api/quizzes/teacher/my-quizzes');record('QA-NO-SESSION','401',authless.status,authless.status===401);
  const forbidden=await api('/api/quizzes/teacher/my-quizzes','GET',undefined,studentToken);record('QA-STUDENT-TEACHER','403',forbidden.status,forbidden.status===403);
  const retired=await api('/api/auth/verify-face-login','POST',{});record('QA-RETIRED-FACE-ENDPOINT','404',retired.status,retired.status===404);
  const unknown=await api('/api/auth/login','POST',{email:'missing-qa@quizshield.invalid',password:env.STAGING_TEST_PASSWORD});record('QA-INVALID-CREDENTIALS','401',unknown.status,unknown.status===401);
  const badtype=await api('/api/auth/login','POST',{email:{unexpected:true},password:[]});record('QA-LOGIN-TYPES','400',badtype.status,badtype.status===400);
  const catalog=await api('/api/courses');
  record('QA-PUBLIC-COURSE-CODES','200 catalog excludes private join codes',Array.isArray(catalog.data)?catalog.data.filter(x=>x.course_code||x.courseCode).length:'not-array',catalog.status===200&&Array.isArray(catalog.data)&&!catalog.data.some(x=>x.course_code||x.courseCode),{httpStatus:catalog.status,courses:Array.isArray(catalog.data)?catalog.data.length:0});
  const question=await api('/api/courses/questions','POST',{text:'QA private answer probe',options:['Correct','Incorrect'],correctAnswer:0,questionType:'multipleChoice',difficulty:'Easy'},token);
  if(question.status===201){
    const qid=question.data._id;
    try {
      const leak=await api('/api/questions/'+qid,'GET',undefined,studentToken);
      const exposes=Object.hasOwn(leak.data||{},'correct_answer')||Object.hasOwn(leak.data||{},'correct_answers');
      record('QA-STUDENT-QUESTION-KEY','403 and no private answer key',leak.status,leak.status===403&&!exposes,{answerKeyFieldsPresent:exposes});
    } finally { check(await db.from('questions').delete().eq('id',qid).eq('created_by',ids.teacher)); }
  } else record('QA-QUESTION-CREATE','201',question.status,false);
  const completed=await api('/api/quizzes/attempt/'+ids.googleAttempt+'/results','GET',undefined,studentToken);
  record('QA-OWN-RELEASED-RESULT','200',completed.status,completed.status===200);
  const health=await api('/health'); record('QA-HEALTH-DB','database ok',health.value.checks?.database,health.value.checks?.database==='ok',{ai:health.value.checks?.ai});
  const output={verifiedAt:new Date().toISOString(),environment:'hosted-staging',phase:process.argv[2]||'baseline',cameraAccessRequired:false,results:rows};
  fs.mkdirSync('../qa',{recursive:true});fs.writeFileSync('../qa/'+output.phase+'-api.json',JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
