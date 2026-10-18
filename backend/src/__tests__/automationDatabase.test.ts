import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';

const teacher = '10000000-0000-4000-8000-000000000001';
const student = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const course = '30000000-0000-4000-8000-000000000001';
const quiz = '40000000-0000-4000-8000-000000000001';
let db: PGlite;
const rows = async (sql: string, params: any[] = []) => (await db.query<any>(sql, params)).rows;
const one = async (sql: string, params: any[] = []) => (await rows(sql, params))[0];
const createQuiz = async (assigned: string[] | null = null) => {
  await db.query(`INSERT INTO teacher_quizzes(id,teacher_id,course_id,title,questions,lifecycle,scheduled_start,closes_at,time_limit,assigned_student_ids)
    VALUES($1,$2,$3,'Controlled test','[{"text":"What is 2+2?","options":["4","5"],"correctAnswer":0}]','draft',now()-interval '1 hour',now()+interval '2 hours',30,$4)`, [quiz,teacher,course,assigned]);
};
const publish = () => db.query(`UPDATE teacher_quizzes SET lifecycle='published' WHERE id=$1`, [quiz]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await db.exec(fs.readFileSync(path.join(__dirname, '../scripts/create-all-tables.sql'), 'utf8'));
  await db.exec(`ALTER TABLE teacher_quizzes ADD COLUMN course_id uuid REFERENCES courses(id);`);
  await db.exec(fs.readFileSync(path.join(__dirname, '../../migrations/007_durable_automations.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../../migrations/008_verified_google_connections.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../../migrations/009_course_join_codes.sql'), 'utf8'));
}, 60000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE users,courses,teacher_quizzes,quiz_attempts,automation_jobs,automation_records CASCADE');
  await db.query(`INSERT INTO users(id,name,email,role,password) VALUES($1,'Teacher','teacher@example.test','teacher','unused-test-hash'),($2,'Student','student@example.test','student','unused-test-hash'),($3,'Other','other@example.test','student','unused-test-hash')`, [teacher,student,other]);
  await db.query(`INSERT INTO courses(id,title,created_by) VALUES($1,'Test course',$2)`, [course,teacher]);
  await db.query(`INSERT INTO enrollments(user_id,course_id) VALUES($1,$3),($2,$3)`, [student,other,course]);
  await db.exec('DELETE FROM automation_jobs');
});

test('saving a draft is quiet; publication persists assigned recipient jobs exactly once', async () => {
  await createQuiz([student]);
  expect(await rows('SELECT * FROM automation_jobs')).toHaveLength(0);
  await publish(); await publish();
  const announcements = await rows(`SELECT * FROM automation_jobs WHERE kind='announcement'`);
  expect(announcements).toHaveLength(2);
  expect(announcements.every(j => j.student_id === student)).toBe(true);
  expect(await rows(`SELECT * FROM automation_jobs WHERE kind='reminder'`)).toHaveLength(1);
});
test('course-code migration backfills missing join codes, preserves existing codes and enforces uniqueness',async()=>{
  const migration=fs.readFileSync(path.join(__dirname,'../../migrations/009_course_join_codes.sql'),'utf8');
  await db.exec(migration);
  const first=await one('SELECT course_code FROM courses WHERE id=$1',[course]);
  expect(first.course_code).toMatch(/^[A-F0-9]{6}$/);
  await db.exec(migration);
  expect((await one('SELECT course_code FROM courses WHERE id=$1',[course])).course_code).toBe(first.course_code);
  await expect(db.query('INSERT INTO courses(title,created_by,course_code) VALUES($1,$2,$3)',['Duplicate',teacher,first.course_code])).rejects.toThrow();
});
test('Google connected flags require verified installation, webhook and destination metadata',async()=>{
  await db.query('INSERT INTO automation_connections(teacher_id,tenant_id) VALUES($1,$2)',[teacher,'tenant']);
  await expect(db.query('UPDATE automation_connections SET calendar_connected=true WHERE teacher_id=$1',[teacher])).rejects.toThrow('verified_google_connection');
  await db.query(`UPDATE automation_connections SET installation_id='inst_ab12',verified_at=now(),
    google_webhook_url='https://webhooks.fastn.dev/prod/triggers/staging/webhooks/11111111-1111-4111-8111-111111111111',verified_calendar_id='owned',calendar_connected=true WHERE teacher_id=$1`,[teacher]);
  await expect(db.query('UPDATE automation_connections SET installation_id=NULL WHERE teacher_id=$1',[teacher])).rejects.toThrow('verified_google_connection');
  await expect(db.query('UPDATE automation_connections SET google_webhook_url=NULL WHERE teacher_id=$1',[teacher])).rejects.toThrow('verified_google_connection');
});
test('an invalid save rolls back its outbox records', async () => {
  await createQuiz();
  await expect(db.query(`UPDATE teacher_quizzes SET lifecycle='published',closes_at=scheduled_start-interval '1 day' WHERE id=$1`, [quiz])).rejects.toThrow();
  expect(await rows('SELECT * FROM automation_jobs')).toHaveLength(0);
  expect((await one('SELECT lifecycle FROM teacher_quizzes')).lifecycle).toBe('draft');
});
test('availability is enforced without any browser or application server running', async () => {
  await createQuiz(); await publish();
  await db.query(`UPDATE teacher_quizzes SET scheduled_start=now()+interval '1 hour' WHERE id=$1`, [quiz]);
  await expect(db.query('SELECT start_teacher_assessment($1,$2)', [quiz,student])).rejects.toThrow('not available');
  await db.query(`UPDATE teacher_quizzes SET scheduled_start=now()-interval '1 hour' WHERE id=$1`, [quiz]);
  expect((await one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student])).a.status).toBe('in-progress');
});
test('attempt duration is separate from the availability window and repeated starts resume', async () => {
  await createQuiz(); await publish();
  const [a,b] = await Promise.all([one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student]),one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student])]);
  expect(a.a.id).toBe(b.a.id);
  expect(Date.parse(a.a.deadline_at)-Date.parse(a.a.started_at)).toBe(30*60_000);
  expect(await rows('SELECT * FROM quiz_attempts')).toHaveLength(1);
});
test('late starts get only the remaining availability window', async () => {
  await createQuiz(); await publish();
  await db.query(`UPDATE teacher_quizzes SET closes_at=now()+interval '5 minutes' WHERE id=$1`, [quiz]);
  const { a } = await one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student]);
  const q = await one('SELECT closes_at::text FROM teacher_quizzes');
  expect(Date.parse(a.deadline_at)).toBe(Date.parse(q.closes_at));
});
test('unassigned students cannot start and attempt identity/deadline are immutable', async () => {
  await createQuiz([student]); await publish();
  await expect(db.query('SELECT start_teacher_assessment($1,$2)', [quiz,other])).rejects.toThrow('not assigned');
  await one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student]);
  await expect(db.exec(`UPDATE quiz_attempts SET deadline_at=now()+interval '10 days'`)).rejects.toThrow('immutable');
});
test('submission is rejected by Postgres itself after closing or cancellation', async () => {
  await createQuiz(); await publish();
  await one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student]);
  await db.query(`UPDATE teacher_quizzes SET closes_at=now()-interval '1 minute' WHERE id=$1`, [quiz]);
  await expect(db.exec(`UPDATE quiz_attempts SET status='completed',answers='[]'`)).rejects.toThrow('deadline');
});
test('rescheduling invalidates old jobs and retimes one unsent reminder', async () => {
  await createQuiz(); await publish();
  const original = await one(`SELECT id,version FROM automation_jobs WHERE kind='reminder' LIMIT 1`);
  await db.query(`UPDATE teacher_quizzes SET closes_at=now()+interval '3 days' WHERE id=$1`, [quiz]);
  const reminder = await one(`SELECT * FROM automation_jobs WHERE id=$1`, [original.id]);
  expect(reminder.status).toBe('pending');
  expect(reminder.version).toBeGreaterThan(original.version);
  expect(Date.parse(reminder.run_at)).toBeGreaterThan(Date.now()+40*3600_000);
  expect(await rows(`SELECT * FROM automation_jobs WHERE kind='calendar' AND status='pending'`)).toHaveLength(1);
});
test('a delivered reminder is never reactivated by rescheduling', async () => {
  await createQuiz(); await publish();
  await db.exec(`UPDATE automation_jobs SET status='succeeded',first_delivery_at=now(),provider_id='receipt' WHERE kind='reminder'`);
  await db.query(`UPDATE teacher_quizzes SET closes_at=now()+interval '3 days' WHERE id=$1`, [quiz]);
  expect(await rows(`SELECT * FROM automation_jobs WHERE kind='reminder' AND status='succeeded'`)).toHaveLength(2);
});
test('cancellation queues updates and prevents attempts', async () => {
  await createQuiz(); await publish();
  await db.query(`UPDATE teacher_quizzes SET lifecycle='cancelled',is_active=false WHERE id=$1`, [quiz]);
  expect(await rows(`SELECT * FROM automation_jobs WHERE kind='reminder' AND status='pending'`)).toHaveLength(0);
  expect(await rows(`SELECT * FROM automation_jobs WHERE kind='cancellation'`)).toHaveLength(4);
  await expect(db.query('SELECT start_teacher_assessment($1,$2)', [quiz,student])).rejects.toThrow('not available');
});
test('saving a reviewed grade stays quiet; explicit release queues one private workflow set', async () => {
  await createQuiz(); await publish();
  const { a } = await one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student]);
  await db.exec('DELETE FROM automation_jobs');
  await db.query(`UPDATE quiz_attempts SET status='completed',teacher_grade=80 WHERE id=$1`, [a.id]);
  expect(await rows('SELECT * FROM automation_jobs')).toHaveLength(0);
  await db.query(`UPDATE quiz_attempts SET results_released_at=now() WHERE id=$1`, [a.id]);
  await db.query(`UPDATE quiz_attempts SET results_released_at=results_released_at WHERE id=$1`, [a.id]);
  const jobs = await rows('SELECT * FROM automation_jobs');
  expect(jobs).toHaveLength(4);
  expect(jobs.every(j => j.student_id === student && j.attempt_id === a.id)).toBe(true);
  await expect(db.query('UPDATE quiz_attempts SET teacher_grade=0 WHERE id=$1', [a.id])).rejects.toThrow('Released grades');
});
test('unreviewed results cannot be released', async () => {
  await createQuiz(); await publish();
  await one('SELECT start_teacher_assessment($1,$2) AS a', [quiz,student]);
  await expect(db.exec('UPDATE quiz_attempts SET results_released_at=now()')).rejects.toThrow('Review a completed');
});
test('expired dispatches are quarantined; claims are durable and never re-send automatically', async () => {
  await createQuiz(); await publish();
  await db.exec(`UPDATE automation_jobs SET status='cancelled' WHERE channel IN ('inapp','internal')`);
  const a = await one('SELECT * FROM claim_automation_job()');
  expect(a.status).toBe('running');
  const b = await one('SELECT * FROM claim_automation_job()');
  expect(a.id).not.toBe(b.id);
  await db.query(`UPDATE automation_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1`, [a.id]);
  await rows('SELECT * FROM claim_automation_job()');
  expect((await one('SELECT status FROM automation_jobs WHERE id=$1', [a.id])).status).toBe('uncertain');
});
test('fixed Sheet rows and Calendar destinations survive retries and destination changes', async () => {
  const bind = (key: string, destination = 'sheet-a') => one('SELECT bind_automation_record($1,$2,$3,$4) AS r', [teacher,key,destination,'Results']);
  const [a,b] = await Promise.all([bind('sheets:one'),bind('sheets:one')]);
  expect(a.r.row_number).toBe(2); expect(b.r.row_number).toBe(2);
  expect((await bind('sheets:two')).r.row_number).toBe(3);
  expect((await bind('sheets:one','sheet-b')).r.destination).toBe('sheet-a');
});
test('saved preferences retime unsent reminders and re-enable disabled Calendar sync', async () => {
  await createQuiz(); await publish();
  await db.exec(`UPDATE automation_jobs SET status='cancelled' WHERE kind='calendar'`);
  await db.query(`INSERT INTO automation_settings(teacher_id,deadline_reminder,reminder_hours,calendar_sync) VALUES($1,true,1,true)`, [teacher]);
  expect(await rows(`SELECT * FROM automation_jobs WHERE kind='calendar' AND status='pending'`)).toHaveLength(1);
  const reminder=await one(`SELECT run_at::text FROM automation_jobs WHERE kind='reminder' LIMIT 1`);
  expect(Date.parse(reminder.run_at)).toBeGreaterThan(Date.now()+50*60_000);
});
test('database guards assessment questions and blocks direct browser access', async () => {
  await createQuiz(); await publish(); await one('SELECT start_teacher_assessment($1,$2)',[quiz,student]);
  await expect(db.exec(`UPDATE teacher_quizzes SET questions='[]'`)).rejects.toThrow('Questions cannot change');
  const privileges=await one(`SELECT has_table_privilege('anon','teacher_quizzes','SELECT') AS anon,has_table_privilege('authenticated','automation_jobs','SELECT') AS student`);
  expect(privileges.anon).toBe(false); expect(privileges.student).toBe(false);
});
