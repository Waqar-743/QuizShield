// Operator acceptance harness: staging only. Credentials stay in ignored env
// files. Output contains IDs and assertions, never credentials or message bodies.
const fs = require('fs');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const env = dotenv.parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL, 'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL, 'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS, 'false');
if (!['assert-hosted','receipt','replay-hosted'].includes(process.argv[2])) assert.equal(env.AUTOMATION_GOOGLE_ENABLED, 'false');
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fixturesPath = '.vercel/staging-fixtures.json';
const ids = JSON.parse(fs.readFileSync(fixturesPath));
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const save = () => fs.writeFileSync(fixturesPath, JSON.stringify(ids, null, 2));
async function api(path, body, token, method = 'POST') {
  const response = await fetch(env.BACKEND_PUBLIC_URL + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${value.message}`);
  return value.data;
}
async function teacherToken() {
  const login = await api('/api/auth/login', { email: 'teacher@quizshield.invalid', password: env.STAGING_TEST_PASSWORD });
  assert.ok(login.token, 'Hosted teacher login must issue a token');
  return login.token;
}
async function jobs() {
  return check(await db.from('automation_jobs').select('*').eq('quiz_id', ids.quiz));
}
async function main() {
  const phase = process.argv[2];
  if (phase === 'draft') {
    const token = await teacherToken();
    const created = await api('/api/quizzes', { title: 'Controlled hosted email acceptance', courseId: ids.course,
      scheduledStart: new Date(Date.now() + 2 * 3600000).toISOString(), closesAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      timezone: 'Asia/Karachi', timeLimit: 15, assignedStudentIds: [ids.student], cameraMonitoring: false,
      questions: [{ text: 'What is 2 + 2?', options: ['4','5'], correctAnswer: 0, difficulty: 'Easy', explanation: 'Two plus two equals four.' }] }, token);
    ids.quiz = created._id; assert.ok(ids.quiz); save();
    assert.equal((await jobs()).length, 0);
    console.log(JSON.stringify({ phase, quizId: ids.quiz, hostedApi: true, persistedJobs: 0, passed: true }));
  } else if (phase === 'publish') {
    const token = await teacherToken();
    await api(`/api/quizzes/teacher/${ids.quiz}/publish`, {}, token);
    await api(`/api/quizzes/teacher/${ids.quiz}/publish`, {}, token);
    const rows = await jobs();
    const announcement = rows.filter(r => r.kind === 'announcement' && r.channel === 'email');
    assert.equal(announcement.length, 1); assert.equal(announcement[0].student_id, ids.student);
    assert.equal(rows.filter(r => r.student_id === ids.unassigned).length, 0);
    ids.announcementJob = announcement[0].id; save();
    console.log(JSON.stringify({ phase, quizId: ids.quiz, announcementJobId: ids.announcementJob,
      assignedEmailJobs: announcement.length, unassignedJobs: 0, passed: true }));
  } else if (phase === 'prepare-callback') {
    const jobId = process.argv[3] || ids.announcementJob;
    const token = crypto.randomUUID();
    const job = check(await db.from('automation_jobs').update({ status: 'awaiting', execution_token: token,
      lease_until: new Date(Date.now() + 300000).toISOString() }).eq('id', jobId).select().single());
    const base = `${env.BACKEND_PUBLIC_URL}/api/automations/delivery/${job.id}`;
    const input = { deliveryId: `${job.id}:${job.attempts}`, idempotencyKey: job.dedupe_key, channel: job.channel,
      kind: job.kind, executionToken: token, preflightUrl: `${base}/preflight`, emailDeliveryUrl: `${base}/email`, completeUrl: `${base}/complete` };
    // Short-lived credential: keep it in an environment setting, not an artifact.
    const name = 'STAGING_CALLBACK_INPUT';
    let content = fs.readFileSync('.env.staging.local', 'utf8').replace(/^STAGING_CALLBACK_INPUT=.*\r?\n/gm, '');
    fs.writeFileSync('.env.staging.local', content + `${name}='${JSON.stringify(input)}'\n`);
    console.log(JSON.stringify({ phase, jobId, tokenStoredInIgnoredEnvironment: true }));
  } else if (phase === 'receipt') {
    const job = (await jobs()).find(r => r.id === ids.announcementJob);
    assert.equal(job.status, 'succeeded'); assert.ok(job.provider_id);
    const response = await fetch('https://api.resend.com/emails/' + job.provider_id, { headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY } });
    assert.equal(response.status, 200); const email = await response.json();
    assert.deepEqual(email.to, [env.AUTOMATION_TEST_RECIPIENTS]);
    assert.equal(email.id, job.provider_id);
    console.log(JSON.stringify({ phase, jobId: job.id, providerId: email.id, recipientCount: email.to.length,
      providerEvent: email.last_event, jobStatus: job.status, passed: true }));
  } else if (phase === 'ineligible') {
    const token = await teacherToken();
    const created = ids.ineligibleQuiz ? { _id: ids.ineligibleQuiz } : await api('/api/quizzes', { title: 'Submitted reminder acceptance', courseId: ids.course,
      scheduledStart: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 2 * 3600000).toISOString(),
      timezone: 'Asia/Karachi', timeLimit: 15, assignedStudentIds: [ids.student], cameraMonitoring: false,
      questions: [{ text: 'What is 2 + 2?', options: ['4','5'], correctAnswer: 0, difficulty: 'Easy' }] }, token);
    const quizId = created._id;
    ids.ineligibleQuiz = quizId; save();
    await api(`/api/quizzes/teacher/${quizId}/publish`, {}, token);
    const quiz = check(await db.from('teacher_quizzes').select('*').eq('id', quizId).single());
    const login = await api('/api/auth/login', { email: env.AUTOMATION_TEST_RECIPIENTS, password: env.STAGING_TEST_PASSWORD });
    // Synthetic descriptor belongs only to this deliberately created fixture.
    const studentSession = login.requiresFaceVerification ? await api('/api/auth/verify-face-login',
      { tempToken: login.tempToken, faceEncoding: Array(128).fill(0.01) }) : login;
    const attempt = await api(`/api/quizzes/start-by-code/${quiz.access_code}`, {}, studentSession.token);
    await api(`/api/quizzes/${attempt.attemptId}/submit-all`, { answers: [{ questionId: `${quizId}-q0`, selectedAnswer: 0 }] }, studentSession.token);
    const reminder = check(await db.from('automation_jobs').select('*').eq('quiz_id', quizId).eq('kind', 'reminder').eq('channel', 'email').single());
    ids.ineligibleQuiz = quizId; ids.ineligibleJob = reminder.id; save();
    console.log(JSON.stringify({ phase, quizId, attemptId: attempt.attemptId, reminderJobId: reminder.id, submittedThroughHostedApi: true }));
  } else if (phase === 'invalidate') {
    const token = await teacherToken();
    const before = check(await db.from('automation_jobs').select('id,version,status').eq('quiz_id', ids.ineligibleQuiz).eq('kind', 'reminder').single());
    const quiz = check(await db.from('teacher_quizzes').select('*').eq('id', ids.ineligibleQuiz).single());
    await api(`/api/quizzes/${ids.ineligibleQuiz}`, { title: quiz.title, questions: quiz.questions,
      timeLimit: quiz.time_limit, scheduledStart: quiz.scheduled_start, timezone: quiz.timezone,
      assignedStudentIds: quiz.assigned_student_ids, cameraMonitoring: quiz.camera_monitoring,
      closesAt: new Date(Date.now() + 3 * 3600000).toISOString() }, token, 'PUT');
    const after = check(await db.from('automation_jobs').select('id,version,status').eq('id', before.id).single());
    assert.ok(after.version > before.version, 'Unsent one-reminder row must adopt the new revision');
    await api(`/api/quizzes/teacher/${ids.ineligibleQuiz}/cancel`, {}, token);
    const cancelled = check(await db.from('automation_jobs').select('id,version,status').eq('id', before.id).single());
    assert.equal(cancelled.status, 'cancelled');
    console.log(JSON.stringify({ phase, quizId: ids.ineligibleQuiz, oldRevision: before.version,
      rescheduledRevision: after.version, reminderStatus: cancelled.status, passed: true }));
  } else if (phase === 'allowlist') {
    const token = await teacherToken();
    const created = await api('/api/quizzes', { title: 'Disallowed recipient acceptance', courseId: ids.course,
      scheduledStart: new Date(Date.now() + 10 * 60000).toISOString(), closesAt: new Date(Date.now() + 2 * 3600000).toISOString(),
      timezone: 'Asia/Karachi', timeLimit: 15, assignedStudentIds: [ids.unassigned], cameraMonitoring: false,
      questions: [{ text: 'What is 2 + 2?', options: ['4','5'], correctAnswer: 0, difficulty: 'Easy' }] }, token);
    await api(`/api/quizzes/teacher/${created._id}/publish`, {}, token);
    const job = check(await db.from('automation_jobs').select('*').eq('quiz_id', created._id).eq('kind','announcement').eq('channel','email').single());
    const executionToken = crypto.randomUUID();
    check(await db.from('automation_jobs').update({ status:'awaiting', execution_token:executionToken,
      lease_until:new Date(Date.now()+300000).toISOString() }).eq('id',job.id));
    const response = await fetch(`${env.BACKEND_PUBLIC_URL}/api/automations/delivery/${job.id}/email`,
      { method:'POST', headers:{'x-quizshield-execution-token':executionToken}, signal:AbortSignal.timeout(15000) });
    assert.equal(response.status,403, 'A currently assigned recipient outside the allowlist must be rejected before the provider');
    const after = check(await db.from('automation_jobs').select('first_delivery_at,provider_id').eq('id',job.id).single());
    assert.equal(after.first_delivery_at,null); assert.equal(after.provider_id,null);
    check(await db.from('automation_jobs').update({status:'cancelled',last_error:'Disallowed recipient fixture cleanup'}).eq('quiz_id',created._id));
    ids.disallowedQuiz = created._id; save();
    console.log(JSON.stringify({phase,quizId:created._id,jobId:job.id,status:response.status,providerAttempted:false,passed:true}));
  } else if (phase === 'queue-hosted') {
    const token = await teacherToken();
    const settings = await api('/api/automations/settings', undefined, token, 'GET');
    assert.equal(settings.fastnConfigured, true, 'Configure the hosted Fastn service key first');
    assert.equal(settings.controlledRecipients, true);
    const title = 'Hosted cron acceptance ' + new Date().toISOString();
    const created = await api('/api/quizzes', { title, courseId: ids.course,
      scheduledStart: new Date(Date.now() + 10 * 60000).toISOString(),
      closesAt: new Date(Date.now() + 62 * 60000).toISOString(),
      timezone: 'Asia/Karachi', timeLimit: 15, assignedStudentIds: [ids.student], cameraMonitoring: false,
      questions: [{ text: 'What is 2 + 2?', options: ['4','5'], correctAnswer: 0, difficulty: 'Easy' }] }, token);
    ids.hostedQuiz = created._id; ids.hostedTitle = title; save();
    await api(`/api/quizzes/teacher/${created._id}/publish`, {}, token);
    const rows = check(await db.from('automation_jobs').select('id,kind,run_at,student_id').eq('quiz_id', created._id).eq('channel','email'));
    assert.equal(rows.length, 2); assert.ok(rows.every(r => r.student_id === ids.student));
    console.log(JSON.stringify({ phase, quizId: created._id, queued: rows, note: 'Do not invoke a local worker; wait for the hosted cron.' }));
  } else if (phase === 'assert-hosted') {
    const rows = check(await db.from('automation_jobs').select('id,kind,status,provider_id').eq('quiz_id', ids.hostedQuiz).eq('channel', 'email').in('kind',['announcement','reminder']));
    assert.equal(rows.length, 2);
    const receipts = [];
    for (const job of rows) {
      assert.equal(job.status, 'succeeded', `${job.kind} must complete via the hosted scheduler`);
      const response = await fetch('https://api.resend.com/emails/' + job.provider_id, { headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY } });
      assert.equal(response.status, 200); const email = await response.json();
      assert.deepEqual(email.to, [env.AUTOMATION_TEST_RECIPIENTS]);
      assert.ok(email.text.includes(env.FRONTEND_URL), 'Message links must point to staging');
      receipts.push({ jobId: job.id, kind: job.kind, providerId: email.id, event: email.last_event });
    }
    const list = await fetch('https://api.resend.com/emails?limit=100', { headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY } });
    assert.equal(list.status, 200); const providerList = await list.json();
    assert.equal(providerList.data.filter(email => email.subject.includes(ids.hostedTitle)).length, 2, 'Exactly announcement + reminder, with no duplicate provider records');
    const evidence = { phase, verifiedAt: new Date().toISOString(), quizId: ids.hostedQuiz,
      providerRecords: 2, approvedRecipientCount: 1, stagingMessageLinks: true, receipts, passed: true };
    fs.writeFileSync('deploy/HOSTED-EMAIL-EVIDENCE.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } else if (phase === 'replay-hosted') {
    const row = check(await db.from('automation_jobs').select('id,status').eq('quiz_id',ids.hostedQuiz)
      .eq('kind','announcement').eq('channel','email').single());
    assert.equal(row.status,'succeeded');
    const statuses = [];
    for (let i=0;i<2;i++) {
      const response = await fetch(env.BACKEND_PUBLIC_URL+'/api/automations/diagnostics', { method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.AUTOMATION_WORKER_SECRET},
        body:JSON.stringify({probe:true,replayCompleted:true,completedJobId:row.id}),signal:AbortSignal.timeout(20000) });
      assert.equal(response.status,200);
      const body = await response.json();
      assert.equal(body.data.keyMode,'live');
      assert.equal(body.data.probeStatus,409,'The hosted webhook must reject this already accepted delivery ID');
      statuses.push(body.data.probeStatus);
    }
    console.log(JSON.stringify({phase,jobId:row.id,replayStatuses:statuses,passed:true,
      note:'Run assert-hosted and correlate Fastn executions to confirm unchanged provider count.'}));
  } else throw new Error('Choose draft, publish, prepare-callback, receipt, ineligible, invalidate, queue-hosted, assert-hosted or replay-hosted');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
