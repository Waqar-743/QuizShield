// Cross-teacher boundary probe using only disposable staging fixtures.
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const checked=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const fixturePath='.vercel/qa-violation-actor.json';
async function call(path,body,token,method='POST'){
 const r=await fetch(env.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 return {status:r.status,data:(await r.json()).data};
}
(async()=>{
 let actor;if(fs.existsSync(fixturePath))actor=JSON.parse(fs.readFileSync(fixturePath));else{
  actor={email:'qa-permission-'+crypto.randomUUID()+'@quizshield.invalid',password:'Qa9'+crypto.randomBytes(16).toString('hex')};
  const r=await call('/api/auth/register',{name:'QA permission teacher',...actor,role:'teacher'});assert.equal(r.status,201);actor.id=r.data.user._id;fs.writeFileSync(fixturePath,JSON.stringify(actor));
 }
 const other=(await call('/api/auth/login',{email:actor.email,password:actor.password})).data.token;
 const owner=(await call('/api/auth/login',{email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD})).data.token;
 const target=JSON.parse(fs.readFileSync('.vercel/qa-timing-fixtures.json')).quizzes[0].attempt;
 const before=checked(await db.from('quiz_attempts').select('status,is_flagged').eq('id',target).single());
 const results=[];
 try{
  for(const action of ['violations','flag','invalidate']){
   const r=await call('/api/quizzes/attempts/'+target+'/'+action,action==='violations'?undefined:{},other,action==='violations'?'GET':'POST');
   results.push({id:'FOREIGN-'+action.toUpperCase(),httpStatus:r.status,pass:r.status===403});
  }
  const own=await call('/api/quizzes/attempts/'+target+'/violations',undefined,owner,'GET');
  results.push({id:'OWNER-VIOLATIONS',httpStatus:own.status,pass:own.status===200});
  if(process.argv[2]!=='before'){
   const released=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json')).googleAttempt;
   const r=await call('/api/quizzes/attempts/'+released+'/invalidate',{},owner);
   results.push({id:'RELEASED-INVALIDATION-BLOCKED',httpStatus:r.status,pass:r.status===409});
  }
 }finally{checked(await db.from('quiz_attempts').update(before).eq('id',target));}
 const report={verifiedAt:new Date().toISOString(),environment:'hosted-staging',fixtureAttempt:target,results,cleanup:'Original attempt flag/status restored'};
 fs.writeFileSync('../qa/violations-'+(process.argv[2]||'after')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
