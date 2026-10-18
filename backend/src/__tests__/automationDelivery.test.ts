import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockTables: Record<string, any[]> = {};
function mockQuery(table: string) {
  const predicates: ((r: any) => boolean)[] = [];
  let single = false, patch: any, columns = '*', limit = Infinity;
  const query: any = {
    select: (s = '*') => { columns = s; return query; },
    eq: (k: string,v: any) => { predicates.push(r => r[k] === v); return query; },
    in: (k: string,v: any[]) => { predicates.push(r => v.includes(r[k])); return query; },
    is: (k: string,v: any) => { predicates.push(r => r[k] == v); return query; },
    update: (v: any) => { patch=v; return query; },
    upsert: () => query,
    order: () => query,
    limit: (n: number) => { limit=n; return query; },
    maybeSingle: () => { single=true; return query; },
    single: () => { single=true; return query; },
    then: (resolve: any,reject: any) => {
      let matched=(mockTables[table] || []).filter(r=>predicates.every(p=>p(r))).slice(0,limit);
      if (patch) matched.forEach(r=>Object.assign(r,patch));
      if (columns !== '*') matched=matched.map(r=>Object.fromEntries(columns.split(',').map(k=>[k,r[k]])));
      return Promise.resolve({ data:single ? matched[0] || null : matched,error:null }).then(resolve,reject);
    },
  };
  return query;
}
jest.mock('../config/supabase',()=>({ supabase: { from: jest.fn((table: string)=>mockQuery(table)),rpc:jest.fn() } }));
jest.mock('../config/environment',()=>({ config: {
  jwtSecret:'controlled-test-secret-at-least-32-characters',frontendAppUrl:'https://quizshield.example.test',
  automationLive:true,automationGoogleEnabled:false,automationAllowAll:false,automationRecipients:['student@example.test'],
  automationWorkerSecret:'controlled-worker-secret-at-least-32-characters',
  fastnAccessKey:'fsk_live_controlled-private-key-not-for-output',
} }));
jest.mock('../services/emailService',()=>({ emailService:{sendAutomationEmail:jest.fn(async ()=>'controlled-provider-receipt')} }));

import { automationWebhookFor, prepareAutomation, runAutomationWorker } from '../services/automationService';
import { emailService } from '../services/emailService';
import { supabase } from '../config/supabase';
import { config } from '../config/environment';
import routes from '../routes/automations';
import { errorHandler } from '../middleware/errorHandler';

const job = () => mockTables.automation_jobs[0];
let app: express.Express;
beforeAll(()=>{ jest.spyOn(console,'error').mockImplementation(()=>{}); app=express(); app.use(express.json()); app.use('/api/automations',routes); app.use(errorHandler); });
afterAll(()=>jest.restoreAllMocks());
beforeEach(()=>{
  jest.clearAllMocks();
  Object.assign(mockTables,{
    automation_settings:[{teacher_id:'teacher',deadline_reminder:true}],
    automation_connections:[],
    courses:[{id:'course',title:'Controlled course',created_by:'teacher'}],
    automation_grants:[{teacher_id:'teacher',status:'active',capabilities:['announcement','deadline_reminder','schedule_email','results_email','welcome_email','calendar_sync','sheets_sync'],editable_keys:['calendar_sync','sheets_sync']}],
    users:[{id:'teacher',role:'teacher',status:'active',session_version:0},{id:'student',status:'active',session_version:0,role:'student',name:'Test student',email:'student@example.test'}],
    enrollments:[{id:'enrolled',user_id:'student',course_id:'course'}],
    teacher_quizzes:[{id:'quiz',teacher_id:'teacher',course_id:'course',title:'Controlled assessment',lifecycle:'published',schedule_version:2,
      assigned_student_ids:['student'],timezone:'Asia/Karachi',closes_at:new Date(Date.now()+3600_000).toISOString()}],
    quiz_attempts:[],
    automation_jobs:[{id:'job',teacher_id:'teacher',student_id:'student',course_id:'course',quiz_id:'quiz',kind:'reminder',channel:'email',version:2,
      status:'awaiting',execution_token:'controlled-execution-token',lease_until:new Date(Date.now()+300_000).toISOString(),dedupe_key:'one-reminder'}],
  });
});
test('delivery rechecks current enrolment, assignment, completion, schedule and preference', async ()=>{
  expect((await prepareAutomation(job())).to).toBe('student@example.test');
  mockTables.enrollments=[]; expect(await prepareAutomation(job())).toBeNull();
  mockTables.enrollments=[{user_id:'student',course_id:'course'}];
  mockTables.teacher_quizzes[0].assigned_student_ids=[]; expect(await prepareAutomation(job())).toBeNull();
  mockTables.teacher_quizzes[0].assigned_student_ids=['student'];
  mockTables.quiz_attempts=[{id:'submitted',user_id:'student',quiz_id:'quiz',status:'completed'}]; expect(await prepareAutomation(job())).toBeNull();
  mockTables.quiz_attempts=[]; mockTables.teacher_quizzes[0].schedule_version=3; expect(await prepareAutomation(job())).toBeNull();
  mockTables.teacher_quizzes[0].schedule_version=2; mockTables.automation_settings[0].deadline_reminder=false; expect(await prepareAutomation(job())).toBeNull();
});
test('suspension or revoked assignments block existing delivery callbacks',async()=>{
  mockTables.users.find(r=>r.id==='teacher').status='suspended';
  expect(await prepareAutomation(job())).toBeNull();
  mockTables.users.find(r=>r.id==='teacher').status='active';
  mockTables.automation_grants[0].status='paused';
  expect(await prepareAutomation(job())).toBeNull();
  mockTables.automation_grants[0].status='active';
  mockTables.users.find(r=>r.id==='student').status='deactivated';
  expect(await prepareAutomation(job())).toBeNull();
});
test('email delivery uses the existing Resend service, a private link, and one idempotency key', async ()=>{
  const endpoint='/api/automations/delivery/job/email';
  const first=await request(app).post(endpoint).set('x-quizshield-execution-token',job().execution_token);
  expect(first.status).toBe(200); expect(first.body.delivered).toBe(true);
  const second=await request(app).post(endpoint).set('x-quizshield-execution-token',job().execution_token);
  expect(second.body.alreadyCompleted).toBe(true);
  expect(emailService.sendAutomationEmail).toHaveBeenCalledTimes(1);
  expect(emailService.sendAutomationEmail).toHaveBeenCalledWith(expect.objectContaining({to:'student@example.test'}),'one-reminder');
  expect(job().status).toBe('succeeded');
});
test('preflight exposes no student addresses to Fastn and withdrawn enrolment cancels sending', async ()=>{
  const preflight=await request(app).post('/api/automations/delivery/job/preflight').set('x-quizshield-execution-token',job().execution_token);
  expect(preflight.status).toBe(200); expect(JSON.stringify(preflight.body)).not.toContain('student@example.test');
  mockTables.enrollments=[];
  const delivered=await request(app).post('/api/automations/delivery/job/email').set('x-quizshield-execution-token',job().execution_token);
  expect(delivered.body.skipped).toBe(true); expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
});
test('controlled allowlist blocks unintended recipients', async ()=>{
  mockTables.users.find(r=>r.id==='student').email='real-student@example.test';
  const result=await request(app).post('/api/automations/delivery/job/email').set('x-quizshield-execution-token',job().execution_token);
  expect(result.status).toBe(403); expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
});
test('email-only deployment blocks Google side effects and teacher attempts to enable them', async ()=>{
  expect(await prepareAutomation({...job(),kind:'calendar',channel:'fastn'})).toBeNull();
  const teacher=jwt.sign({id:'teacher',role:'teacher'},config.jwtSecret);
  for (const values of [{calendar_sync:true},{sheets_sync:true}]) {
    const result=await request(app).put('/api/automations/settings').set('Authorization',`Bearer ${teacher}`).send(values);
    expect(result.status).toBe(409);
  }
  expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
});
test('Google delivery requires the owning teacher and verified destination; email routing remains separate',async()=>{
  const previous=config.automationGoogleEnabled;(config as any).automationGoogleEnabled=true;
  try {
    Object.assign(job(),{kind:'calendar',channel:'fastn'});
    Object.assign(mockTables.automation_settings[0],{calendar_sync:true,calendar_id:'owned'});
    mockTables.teacher_quizzes[0].scheduled_start=new Date().toISOString();
    await expect(prepareAutomation(job())).rejects.toThrow('ownership');
    const url='https://webhooks.fastn.dev/prod/triggers/staging/webhooks/11111111-1111-4111-8111-111111111111';
    mockTables.automation_connections=[{teacher_id:'teacher',tenant_id:'tenant',installation_id:'inst_ab12',verified_at:new Date().toISOString(),
      calendar_connected:true,verified_calendar_id:'owned',google_webhook_url:url}];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({data:{destination:'owned'},error:null});
    const payload=await prepareAutomation(job());expect(payload).toMatchObject({tenantId:'tenant',installationId:'inst_ab12',calendarId:'owned'});
    expect(await automationWebhookFor(job())).toBe(url);
    expect(await automationWebhookFor({...job(),channel:'email'})).toBe(config.fastnWebhookUrl);
    const teacher=jwt.sign({id:'teacher',role:'teacher'},config.jwtSecret);
    const denied=await request(app).put('/api/automations/settings').set('Authorization',`Bearer ${teacher}`).send({calendar_id:'unverified',calendar_sync:true});
    expect(denied.status).toBe(403);
    mockTables.automation_settings[0].calendar_id='unverified';await expect(prepareAutomation(job())).rejects.toThrow('destination');
    expect(await prepareAutomation({...job(),teacher_id:'different-teacher'})).toBeNull();
  } finally {(config as any).automationGoogleEnabled=previous;}
});
test('callback failures and expired email deduplication windows never trigger automatic resend', async ()=>{
  job().first_delivery_at=new Date(Date.now()-25*3600_000).toISOString();
  const result=await request(app).post('/api/automations/delivery/job/email').set('x-quizshield-execution-token',job().execution_token);
  expect(result.body.skipped).toBe(true); expect(job().status).toBe('uncertain'); expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
});
test('private results require a reviewed and released completed submission', async ()=>{
  Object.assign(job(),{kind:'results',attempt_id:'attempt',version:null});
  mockTables.quiz_attempts=[{id:'attempt',user_id:'student',quiz_id:'quiz',status:'completed',teacher_grade:82}];
  expect(await prepareAutomation(job())).toBeNull();
  mockTables.quiz_attempts[0].results_released_at=new Date().toISOString();
  const result=await prepareAutomation(job());
  expect(result.text).toContain('/quiz/teacher-results/attempt'); expect(result.text).not.toContain('82');
});
test('authentication rejects temporary face tokens and role checks protect settings', async ()=>{
  const face=jwt.sign({id:'student',role:'student',type:'face_verification'},config.jwtSecret);
  expect((await request(app).get('/api/automations/settings').set('Authorization',`Bearer ${face}`)).status).toBe(401);
  const studentToken=jwt.sign({id:'student',role:'student'},config.jwtSecret);
  expect((await request(app).get('/api/automations/settings').set('Authorization',`Bearer ${studentToken}`)).status).toBe(403);
  expect((await request(app).post('/api/automations/worker')).status).toBe(401);
});
test('operator diagnostics require worker authentication and never expose the service key', async ()=>{
  expect((await request(app).post('/api/automations/diagnostics')).status).toBe(401);
  const result=await request(app).post('/api/automations/diagnostics').set('Authorization',`Bearer ${config.automationWorkerSecret}`);
  expect(result.status).toBe(200); expect(result.body.data.keyMode).toBe('live');
  expect(JSON.stringify(result.body)).not.toContain(config.fastnAccessKey);
  expect(JSON.stringify(result.body)).not.toContain(config.automationWorkerSecret);
  expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
});
test('operator webhook replay accepts only completed email fixtures and preserves their delivery ID', async ()=>{
  const settings = config as any;
  const previous = { backendPublicUrl: settings.backendPublicUrl, fastnWebhookUrl: settings.fastnWebhookUrl };
  Object.assign(settings, { backendPublicUrl:'https://quizshield.example.test', fastnWebhookUrl:'https://fastn.example.test/hook' });
  const fetchMock = jest.spyOn(global,'fetch').mockResolvedValue({ status:202, json:async()=>({eventId:'evt_probe',duplicate:true,secret:config.fastnAccessKey}) } as Response);
  try {
    const replay = () => request(app).post('/api/automations/diagnostics')
      .set('Authorization',`Bearer ${config.automationWorkerSecret}`)
      .send({probe:true,replayCompleted:true,completedJobId:'job'});
    expect((await replay()).status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
    Object.assign(job(),{status:'succeeded',attempts:2});
    for (let i=0;i<2;i++) {
      const result = await replay();
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({probeStatus:202,probeDuplicate:true,probeEventId:'evt_probe'});
      expect(JSON.stringify(result.body)).not.toContain(config.fastnAccessKey);
      expect(JSON.parse(String(fetchMock.mock.calls[i][1]?.body)).deliveryId).toBe('job:2');
    }
    expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
  } finally { fetchMock.mockRestore(); Object.assign(settings,previous); }
});
test('Google diagnostic replay uses only the completed job owners verified webhook',async()=>{
  const settings=config as any,previous={backendPublicUrl:settings.backendPublicUrl,automationGoogleEnabled:settings.automationGoogleEnabled};
  Object.assign(settings,{backendPublicUrl:'https://quizshield.example.test',automationGoogleEnabled:true});
  const url='https://webhooks.fastn.dev/prod/triggers/staging/webhooks/11111111-1111-4111-8111-111111111111';
  Object.assign(job(),{status:'succeeded',channel:'fastn',kind:'calendar',attempts:1});
  mockTables.automation_connections=[{teacher_id:'teacher',tenant_id:'tenant',installation_id:'inst_ab12',verified_at:new Date().toISOString(),google_webhook_url:url}];
  const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue({status:409,json:async()=>({})} as Response);
  try {
    const result=await request(app).post('/api/automations/diagnostics').set('Authorization',`Bearer ${config.automationWorkerSecret}`)
      .send({probe:true,channel:'fastn',completedJobId:'job',replayCompleted:true,webhookUrl:'https://untrusted.example.test'});
    expect(result.status).toBe(200);expect(result.body.data.probeStatus).toBe(409);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({'x-end-org-id':'tenant','x-installation-id':'inst_ab12'});
    const payload=JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({channel:'fastn',tenantId:'tenant',installationId:'inst_ab12',deliveryId:'job:1'});
    expect(JSON.stringify(result.body)).not.toContain(job().execution_token);expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
  }finally{fetchMock.mockRestore();Object.assign(settings,previous);}
});
test('unknown callback tokens cannot send, and failed retries are restricted to their owner', async ()=>{
  expect((await request(app).post('/api/automations/delivery/job/email').set('x-quizshield-execution-token','wrong')).status).toBe(401);
  job().status='failed';
  mockTables.users.push({id:'another-teacher',role:'teacher',status:'active',session_version:0});
  const intruder=jwt.sign({id:'another-teacher',role:'teacher'},config.jwtSecret);
  expect((await request(app).post('/api/automations/jobs/job/retry').set('Authorization',`Bearer ${intruder}`)).status).toBe(409);
  expect(job().status).toBe('failed');
});
test('a missing hosted integration is an actionable failed job, never a false success', async ()=>{
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({data:[{...job(),status:'running'}],error:null}).mockResolvedValue({data:[],error:null});
  const result=await runAutomationWorker();
  expect(result.processed).toBe(1); expect(job().status).toBe('failed'); expect(emailService.sendAutomationEmail).not.toHaveBeenCalled();
});
