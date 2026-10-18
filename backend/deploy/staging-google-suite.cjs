// Per-case saved-workflow fixtures. Pause hosted cron while preparing/using these
// controlled manual jobs; resume it after the suite. Never print callback tokens.
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const path='.vercel/staging-fixtures.json',ids=JSON.parse(fs.readFileSync(path));
const resources=JSON.parse(fs.readFileSync('deploy/GOOGLE-LIVE-EVIDENCE.json'));
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const save=()=>fs.writeFileSync(path,JSON.stringify(ids,null,2));
async function api(path,body,token,method='POST'){
  const r=await fetch(env.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const v=await r.json();if(!r.ok)throw Error(path+':'+r.status);return v.data;
}
const quiz=async()=>check(await db.from('teacher_quizzes').select('*').eq('id',ids.googleManualQuiz).single());
async function prepare(kind){
  const rows=check(await db.from('automation_jobs').select('*').eq('quiz_id',ids.googleManualQuiz).eq('channel','fastn').eq('kind',kind).order('created_at',{ascending:false}).limit(1));
  const j=rows[0];assert.ok(j);assert.ok(['pending','failed'].includes(j.status),'Do not replace an active or completed delivery lease');
  const token=crypto.randomUUID(),changed=check(await db.from('automation_jobs').update({status:'awaiting',execution_token:token,lease_until:new Date(Date.now()+300000).toISOString()}).eq('id',j.id).eq('status',j.status).select('id'));
  assert.equal(changed.length,1);const base=env.BACKEND_PUBLIC_URL+'/api/automations/delivery/'+j.id;
  const input={deliveryId:j.id+':'+j.attempts,idempotencyKey:j.dedupe_key,kind,channel:'fastn',tenantId:resources.endOrgId,installationId:resources.installationId,
    executionToken:token,preflightUrl:base+'/preflight',completeUrl:base+'/complete'};
  let text=fs.readFileSync('.env.staging.local','utf8').replace(/^STAGING_GOOGLE_SUITE_INPUT=.*\r?\n/gm,'');
  fs.writeFileSync('.env.staging.local',text+`STAGING_GOOGLE_SUITE_INPUT='${JSON.stringify(input)}'\n`);
  return {jobId:j.id,version:j.version,kind,tokenStoredInIgnoredEnvironment:true};
}
async function reschedule(t){const q=await quiz();await api('/api/quizzes/'+q.id,{title:q.title,questions:q.questions,timeLimit:q.time_limit,
  scheduledStart:q.scheduled_start,timezone:q.timezone,assignedStudentIds:q.assigned_student_ids,closesAt:new Date(Date.parse(q.closes_at)+600000).toISOString()},t,'PUT');}
async function main(){
  const phase=process.argv[2],t=(await api('/api/auth/login',{email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD})).token;
  if(phase==='create'){
    const q=await api('/api/quizzes',{title:'Saved workflow Google suite '+new Date().toISOString(),courseId:ids.course,scheduledStart:new Date(Date.now()-60000).toISOString(),
      closesAt:new Date(Date.now()+7200000).toISOString(),timezone:'Asia/Karachi',timeLimit:15,assignedStudentIds:[ids.student],questions:[{text:'What is 2 + 2?',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},t);
    ids.googleManualQuiz=q._id;save();await api('/api/quizzes/teacher/'+q._id+'/publish',{},t);
    console.log(JSON.stringify({phase,quizId:q._id,eventId:crypto.createHash('sha256').update(q._id).digest('hex'),...await prepare('calendar')}));
  }else if(phase==='sheets'){
    const q=await quiz(),login=await api('/api/auth/login',{email:env.AUTOMATION_TEST_RECIPIENTS,password:env.STAGING_TEST_PASSWORD});
    const s=login;
    const a=await api('/api/quizzes/start-by-code/'+q.access_code,{},s.token);
    await api('/api/quizzes/'+a.attemptId+'/submit-all',{answers:[{questionId:q.id+'-q0',selectedAnswer:0}]},s.token);
    await api('/api/quizzes/submissions/'+a.attemptId+'/grade',{grade:91,feedback:'Reviewed suite fixture.'},t,'PUT');
    assert.equal(check(await db.from('automation_jobs').select('id').eq('attempt_id',a.attemptId).eq('kind','sheets')).length,0);
    await api('/api/quizzes/submissions/'+a.attemptId+'/release',{},t);
    ids.googleManualAttempt=a.attemptId;save();console.log(JSON.stringify({phase,attemptId:a.attemptId,unreleasedSheetJobs:0,...await prepare('sheets')}));
  }else if(phase==='update'){
    await reschedule(t);console.log(JSON.stringify({phase,...await prepare('calendar')}));
  }else if(phase==='stale'){
    await reschedule(t);const p=await prepare('calendar');await reschedule(t);
    console.log(JSON.stringify({phase,...p,staleStatus:check(await db.from('automation_jobs').select('status').eq('id',p.jobId).single()).status}));
  }else if(phase==='cancel'){
    await api('/api/quizzes/teacher/'+ids.googleManualQuiz+'/cancel',{},t);console.log(JSON.stringify({phase,...await prepare('calendar')}));
  }else throw Error('Choose create, sheets, update, stale or cancel');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
