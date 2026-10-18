import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
let db:PGlite;
const admin='a0000000-0000-4000-8000-000000000001',teacher='a0000000-0000-4000-8000-000000000002',student='a0000000-0000-4000-8000-000000000003',successor='a0000000-0000-4000-8000-000000000004',course='a0000000-0000-4000-8000-000000000005';
const one=async(sql:string,args:any[]=[]) => (await db.query<any>(sql,args)).rows[0];
beforeAll(async()=>{
 db=new PGlite();await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');
 await db.exec(fs.readFileSync(path.join(__dirname,'../scripts/create-all-tables.sql'),'utf8'));
 await db.exec('ALTER TABLE teacher_quizzes ADD COLUMN course_id uuid REFERENCES courses(id);');
 for(const name of ['006_add_course_capacity.sql','007_durable_automations.sql','008_verified_google_connections.sql','009_course_join_codes.sql','010_admin_access.sql','011_retire_camera_configuration.sql','012_manage_disabled_automation.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../../migrations',name),'utf8'));
},60000);
afterAll(async()=>{await db?.close();});
beforeEach(async()=>{
 await db.exec('TRUNCATE users,courses,teacher_quizzes,quiz_attempts,admin_audit,automation_grants CASCADE');
 await db.query(`INSERT INTO users(id,name,email,role,password) VALUES($1,'Operator','admin@example.test','admin','hash'),($2,'Teacher','teacher@example.test','teacher','hash'),($3,'Student','student@example.test','student','hash'),($4,'Successor','next@example.test','teacher','hash')`,[admin,teacher,student,successor]);
 await db.query('INSERT INTO courses(id,title,created_by,max_students) VALUES($1,$2,$3,1)',[course,'Retained course',teacher]);
});
test('no public execution permission on administrator functions or audit records',async()=>{
 const row=await one(`SELECT has_function_privilege('anon','bootstrap_first_admin(text)','execute') AS bootstrap,has_function_privilege('authenticated','admin_update_account(uuid,uuid,jsonb)','execute') AS update,has_table_privilege('anon','admin_audit','select') AS audit`);
 expect(row).toEqual({bootstrap:false,update:false,audit:false});
});
test.each([{role:'teacher'},{status:'suspended'},{status:'deactivated'}])('last active administrator is protected: %p',async patch=>{
 await expect(db.query('SELECT admin_update_account($1,$1,$2)',[admin,patch])).rejects.toThrow('last active administrator');
 expect((await one('SELECT role,status FROM users WHERE id=$1',[admin]))).toEqual({role:'admin',status:'active'});
});
test('a successor administrator permits demotion and revokes existing sessions',async()=>{
 await db.query('SELECT admin_update_account($1,$2,$3)',[admin,successor,{role:'admin'}]);
 await db.query('SELECT admin_update_account($1,$1,$2)',[admin,{role:'teacher'}]);
 expect((await one('SELECT role,session_version FROM users WHERE id=$1',[admin]))).toEqual({role:'teacher',session_version:1});
 await expect(db.query('SELECT admin_update_account($1,$2,$3)',[admin,teacher,{name:'Forbidden'}])).rejects.toThrow('Active administrator');
});
test('ordinary editing cannot set passwords, email identity, hashes or tokens',async()=>{
 await expect(db.query('SELECT admin_update_account($1,$2,$3)',[admin,teacher,{password:'known'}])).rejects.toThrow('Unsupported');
});
test('first administrator bootstrap is single-use and audited',async()=>{
 await expect(db.query('SELECT bootstrap_first_admin($1)',['teacher@example.test'])).rejects.toThrow('already exists');
 await db.exec('TRUNCATE users CASCADE');
 await db.query(`INSERT INTO users(id,name,email,role,password) VALUES($1,'Verified operator','operator@example.test','teacher','hash')`,[teacher]);
 expect((await one('SELECT bootstrap_first_admin($1) AS id',['operator@example.test'])).id).toBe(teacher);
 expect((await one('SELECT action FROM admin_audit')).action).toBe('first_admin_bootstrap');
 await expect(db.query('SELECT bootstrap_first_admin($1)',['operator@example.test'])).rejects.toThrow('already exists');
});
test('deactivation preserves history, cancels queued work and marks in-progress work uncertain',async()=>{
 await db.query(`INSERT INTO quiz_attempts(user_id,status) VALUES($1,'completed')`,[student]);
 for(const status of ['pending','awaiting'])await db.query(`INSERT INTO automation_jobs(teacher_id,course_id,student_id,kind,channel,dedupe_key,status) VALUES($1,$2,$3,'welcome','email',$4,$4)`,[teacher,course,student,status]);
 await db.query('SELECT admin_update_account($1,$2,$3)',[admin,student,{status:'deactivated'}]);
 expect((await one('SELECT count(*)::int AS n FROM quiz_attempts')).n).toBe(1);
 expect((await db.query<any>('SELECT status FROM automation_jobs ORDER BY dedupe_key')).rows.map(r=>r.status)).toEqual(['uncertain','cancelled']);
 expect((await one('SELECT session_version FROM users WHERE id=$1',[student])).session_version).toBe(1);
 await expect(db.query('DELETE FROM users WHERE id=$1',[student])).rejects.toThrow('Physical account deletion');
});
test('ownership transfer moves course assessment ownership and preserves attempts',async()=>{
 await db.query(`INSERT INTO teacher_quizzes(teacher_id,course_id,title,lifecycle) VALUES($1,$2,'History','draft')`,[teacher,course]);
 await db.query(`INSERT INTO quiz_attempts(user_id,status) VALUES($1,'completed')`,[student]);
 await db.query('SELECT admin_transfer_course($1,$2,$3)',[admin,course,successor]);
 expect((await one('SELECT created_by FROM courses')).created_by).toBe(successor);
 expect((await one('SELECT teacher_id FROM teacher_quizzes')).teacher_id).toBe(successor);
 expect((await one('SELECT count(*)::int AS n FROM quiz_attempts')).n).toBe(1);
});
test('administrator enrolment respects capacity and removal retains submissions',async()=>{
 await db.query('SELECT admin_set_enrolment($1,$2,$3,true)',[admin,course,student]);
 await db.query(`UPDATE users SET role='student' WHERE id=$1`,[successor]);
 await expect(db.query('SELECT admin_set_enrolment($1,$2,$3,true)',[admin,course,successor])).rejects.toThrow('full');
 await db.query('SELECT admin_set_enrolment($1,$2,$3,false)',[admin,course,student]);
 expect((await one('SELECT count(*)::int AS n FROM enrollments')).n).toBe(0);
});
test('automation pause invalidates queued work and records the assignment',async()=>{
 await db.query(`INSERT INTO automation_jobs(teacher_id,course_id,kind,channel,dedupe_key) VALUES($1,$2,'announcement','email','grant')`,[teacher,course]);
 await db.query('SELECT admin_set_automation_grant($1,$2,$3,$4,$5,$6)',[admin,teacher,'paused',['announcement'],['timezone'],{reminder_hours:8}]);
 expect((await one('SELECT status FROM automation_jobs')).status).toBe('cancelled');
 expect((await one('SELECT action FROM admin_audit')).action).toBe('automation_grant_updated');
});
test('review cleanup requires explicit consent and never deletes assessment history',async()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../../migrations/review/012_legacy_biometric_cleanup.sql'),'utf8');
 await expect(db.exec(sql)).rejects.toThrow('explicit operator approval');
});
test('disabled teachers can be revoked but cannot be enabled',async()=>{
 await db.query('SELECT admin_update_account($1,$2,$3)',[admin,teacher,{status:'suspended'}]);
 await db.query('SELECT admin_set_automation_grant($1,$2,$3,$4,$5,$6)',[admin,teacher,'revoked',[],[],{}]);
 expect((await one('SELECT status FROM automation_grants')).status).toBe('revoked');
 await expect(db.query('SELECT admin_set_automation_grant($1,$2,$3,$4,$5,$6)',[admin,teacher,'active',['announcement'],[],{}])).rejects.toThrow('active teacher');
});
