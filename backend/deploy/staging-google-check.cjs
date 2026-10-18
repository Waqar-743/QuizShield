// Controlled staging acceptance. Credentials stay in the ignored environment.
const fs = require('fs');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const env = require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db = require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const idsPath='.vercel/staging-fixtures.json', ids=JSON.parse(fs.readFileSync(idsPath));
const resources=JSON.parse(fs.readFileSync('deploy/GOOGLE-LIVE-EVIDENCE.json'));
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const save=()=>fs.writeFileSync(idsPath,JSON.stringify(ids,null,2));
async function api(path,body,token,method='POST') {
  const r=await fetch(env.BACKEND_PUBLIC_URL+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
  const v=await r.json(); if(!r.ok)throw Error(`${method} ${path}: ${r.status}`);return v.data;
}
async function teacher(){const v=await api('/api/auth/login',{email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD});return v.token;}
async function quiz(){return check(await db.from('teacher_quizzes').select('*').eq('id',ids.googleQuiz).single());}
async function review(token) {
  const q=await quiz();
  const login=await api('/api/auth/login',{email:env.AUTOMATION_TEST_RECIPIENTS,password:env.STAGING_TEST_PASSWORD});
  const session=login;
  const a=await api(`/api/quizzes/start-by-code/${q.access_code}`,{},session.token);
  await api(`/api/quizzes/${a.attemptId}/submit-all`,{answers:[{questionId:`${q.id}-q0`,selectedAnswer:0}]},session.token);
  await api(`/api/quizzes/submissions/${a.attemptId}/grade`,{grade:87,feedback:'Reviewed controlled staging submission.'},token,'PUT');
  ids.googleAttempt=a.attemptId;save();
  const before=check(await db.from('automation_jobs').select('id').eq('attempt_id',a.attemptId).eq('kind','sheets'));
  assert.equal(before.length,0,'Review without release must not queue a spreadsheet write');
  return a.attemptId;
}
async function main(){
  const phase=process.argv[2];
  if(phase==='review-probe'){
    const t=await teacher();await api(`/api/quizzes/teacher/${ids.googleQuiz}/publish`,{},t);
    const attemptId=await review(t);
    await api(`/api/quizzes/submissions/${attemptId}/release`,{},t);
    const a=check(await db.from('quiz_attempts').select('*').eq('id',attemptId).single()),q=await quiz();
    const student=check(await db.from('users').select('name,email').eq('id',ids.student).single());
    assert.ok(a.results_released_at);
    const binding=check(await db.rpc('bind_automation_record',{p_teacher:ids.teacher,p_key:`sheets:${a.id}`,p_destination:resources.sheet.id,p_tab:resources.sheet.tab}));
    const payload={spreadsheetId:binding.destination,range:`'${binding.tab}'!A${binding.row_number}:F${binding.row_number}`,valueInputOption:'RAW',
      values:[[a.id,q.title,student.name,student.email,a.teacher_grade,a.results_released_at]]};
    ids.googleProbeQuiz=q.id;ids.googleProbeAttempt=a.id;save();
    console.log(JSON.stringify({phase,quizId:q.id,attemptId:a.id,unreleasedSheetJobs:0,payload}));
  } else if(phase==='begin-hosted'){
    const t=await teacher();
    // All these records belong to the deliberately created staging test teacher.
    const old=check(await db.from('teacher_quizzes').select('id').eq('teacher_id',ids.teacher).eq('lifecycle','published'));
    for(const q of old)await api(`/api/quizzes/teacher/${q.id}/cancel`,{},t);
    check(await db.from('automation_jobs').update({status:'cancelled',last_error:'Older controlled fixture cleanup before Google hosted acceptance'})
      .eq('teacher_id',ids.teacher).in('status',['pending','failed','running','awaiting']));
    await api('/api/automations/settings',{announcement:false,deadline_reminder:false,results_email:false,schedule_email:false,welcome_email:false,
      calendar_id:resources.calendar.id,spreadsheet_id:resources.sheet.id,sheet_tab:resources.sheet.tab,calendar_sync:true,sheets_sync:true},t,'PUT');
    const q=await api('/api/quizzes',{title:'Hosted Google lifecycle '+new Date().toISOString(),courseId:ids.course,
      scheduledStart:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+7200000).toISOString(),timezone:'Asia/Karachi',timeLimit:15,
      assignedStudentIds:[ids.student],questions:[{text:'What is 2 + 2?',options:['4','5'],correctAnswer:0,difficulty:'Easy'}]},t);
    ids.googleQuiz=q._id;ids.googleAttempt=null;save();
    assert.equal(check(await db.from('automation_jobs').select('id').eq('quiz_id',q._id)).length,0);
    await api(`/api/quizzes/teacher/${q._id}/publish`,{},t);
    console.log(JSON.stringify({phase,quizId:q._id,draftJobs:0,eventId:crypto.createHash('sha256').update(q._id).digest('hex'),
      note:'Wait for hosted cron; do not invoke a local worker.'}));
  } else if(phase==='review'){
    const attemptId=await review(await teacher());console.log(JSON.stringify({phase,attemptId,unreleasedSheetJobs:0,passed:true}));
  } else if(phase==='release'){
    const t=await teacher();await api(`/api/quizzes/submissions/${ids.googleAttempt}/release`,{},t);
    await api(`/api/quizzes/submissions/${ids.googleAttempt}/release`,{},t);
    const rows=check(await db.from('automation_jobs').select('id,status').eq('attempt_id',ids.googleAttempt).eq('kind','sheets'));
    assert.equal(rows.length,1);console.log(JSON.stringify({phase,attemptId:ids.googleAttempt,sheetJobs:rows,passed:true}));
  } else if(phase==='reschedule'){
    const t=await teacher(),q=await quiz();
    await api(`/api/quizzes/${q.id}`,{title:q.title,questions:q.questions,timeLimit:q.time_limit,scheduledStart:q.scheduled_start,timezone:q.timezone,
      assignedStudentIds:q.assigned_student_ids,closesAt:new Date(Date.parse(q.closes_at)+600000).toISOString()},t,'PUT');
    console.log(JSON.stringify({phase,quizId:q.id,oldRevision:q.schedule_version,newRevision:(await quiz()).schedule_version}));
  } else if(phase==='cancel'){
    await api(`/api/quizzes/teacher/${ids.googleQuiz}/cancel`,{},await teacher());console.log(JSON.stringify({phase,quizId:ids.googleQuiz}));
  } else if(phase==='status'){
    const q=await quiz(),rows=check(await db.from('automation_jobs').select('id,kind,channel,status,attempts,provider_id,last_error,version').eq('quiz_id',q.id));
    console.log(JSON.stringify({phase,quiz:{id:q.id,title:q.title,lifecycle:q.lifecycle,revision:q.schedule_version,start:q.scheduled_start,end:q.closes_at,timezone:q.timezone},
      eventId:crypto.createHash('sha256').update(q.id).digest('hex'),attemptId:ids.googleAttempt,jobs:rows}));
  } else throw Error('Choose review-probe, begin-hosted, review, release, reschedule, cancel or status');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
