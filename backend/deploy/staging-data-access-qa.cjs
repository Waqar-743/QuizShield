// Read-only direct-client boundary check. Fetch the existing public key without logging it.
const fs=require('fs'),assert=require('node:assert/strict'),child=require('child_process');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
const cli=child.spawnSync('npx.cmd',['--yes','supabase','projects','api-keys','--project-ref','jixzholamkbktzusyqwe','--output','json'],{encoding:'utf8',shell:true});
if(cli.status)throw Error('Cannot retrieve the staging public key');
const anon=JSON.parse(cli.stdout).find(k=>k.name==='anon');assert.ok(anon?.api_key);
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,anon.api_key,{auth:{persistSession:false}});
(async()=>{
 const results=[];
 for(const table of ['users','courses','topics','questions','enrollments','quizzes','quiz_attempts','teacher_quizzes','cheating_violations','notifications','quiz_codes','quiz_questions','automation_settings','automation_connections','automation_jobs','learning_followups','automation_records']){
  // A zero-row GET still checks table privileges and preserves the error body; HEAD does not.
  const r=await db.from(table).select('*').limit(0);
  results.push({table,httpStatus:r.status,errorCode:r.error?.code,pass:[401,403].includes(r.status)&&r.error?.code==='42501'});
 }
 const report={verifiedAt:new Date().toISOString(),environment:'staging-direct-client',zeroRowsRequested:true,results};
 fs.writeFileSync('../qa/direct-database-boundary.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
