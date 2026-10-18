// Hosted content and answer-key checks; fixture values are synthetic.
const fs=require('fs'),assert=require('node:assert/strict');
const e=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(e.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(e.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
const db=require('@supabase/supabase-js').createClient(e.SUPABASE_URL,e.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const f=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json'));
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function api(path,method='GET',body,token){const r=await fetch(e.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});const v=await r.json();return{status:r.status,data:v.data};}
async function main(){
 const t=(await api('/api/auth/login','POST',{email:'teacher@quizshield.invalid',password:e.STAGING_TEST_PASSWORD})).data.token;
 const c=check(await db.from('courses').select('id,course_code').eq('title','QA browser course 18 October').eq('created_by',f.teacher).single());
 const topic=await api('/api/courses/topics','POST',{courseId:c.id,title:'QA topic navigation',description:'Controlled topic content for navigation and permission tests.'},t);assert.equal(topic.status,201);
 const q=await api('/api/questions','POST',{topicId:topic.data._id,questionText:'QA bank ownership',questionType:'multipleChoice',options:['Zero','One'],correctAnswer:1,difficulty:'Easy'},t);assert.equal(q.status,201);const questionId=q.data._id;
 const before=check(await db.from('questions').select('id,created_by,correct_answer').eq('id',questionId).single());
 const updated=await api('/api/questions/'+questionId,'PUT',{correctAnswer:0},t);
 const stored=check(await db.from('questions').select('id,correct_answer').eq('id',questionId).single());
 const u=check(await db.from('users').select('email').eq('id',f.student).single());const login=await api('/api/auth/login','POST',{email:u.email,password:e.STAGING_TEST_PASSWORD});
 const s=login.data.token;
 await api('/api/courses/join-by-code','POST',{courseCode:c.course_code},s);
 const student=await api('/api/courses/topics/'+topic.data._id+'/questions','GET',undefined,s);
 const results=[{id:'QUESTION-CREATOR',pass:before.created_by===f.teacher,status:q.status},{id:'QUESTION-ANSWER-ZERO',pass:updated.status===200&&String(stored.correct_answer)==='0',status:updated.status,storedAnswer:stored.correct_answer},{id:'STUDENT-TOPIC-KEY-PRIVACY',pass:student.status===200&&!student.data.some(x=>Object.hasOwn(x,'correctAnswer')||Object.hasOwn(x,'explanation')),status:student.status}];
 const evidence={verifiedAt:new Date().toISOString(),environment:'hosted-staging',fixtures:{course:c.id,topic:topic.data._id,question:questionId},results};
 fs.writeFileSync('../qa/content-'+(process.argv[2]||'baseline')+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}
main().catch(x=>{console.error(x.message);process.exitCode=1;});
