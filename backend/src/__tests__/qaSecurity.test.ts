import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const mockRows: Record<string, any[]> = {};
function mockQuery(table: string) {
  const filters: ((row: any) => boolean)[]=[];
  let one=false, patch:any, columns='*';
  const q:any={
    select:(s='*')=>{columns=s;return q;},
    eq:(k:string,v:any)=>{filters.push(row=>row[k]===v);return q;},
    in:(k:string,v:any[])=>{filters.push(row=>v.includes(row[k]));return q;},
    gt:(k:string,v:any)=>{filters.push(row=>row[k]>v);return q;},
    update:(v:any)=>{patch=v;return q;},order:()=>q,limit:()=>q,
    single:()=>{one=true;return q;},maybeSingle:()=>{one=true;return q;},
    then:(resolve:any,reject:any)=>{
      let data=(mockRows[table]||[]).filter(row=>filters.every(f=>f(row)));
      if(patch)data.forEach(row=>Object.assign(row,patch));
      if(columns!=='*')data=data.map(row=>Object.fromEntries(columns.split(',').map(k=>[k.trim(),row[k.trim()]])));
      return Promise.resolve({data:one?data[0]||null:data,count:data.length,error:null}).then(resolve,reject);
    },
  };return q;
}
jest.mock('../config/supabase',()=>({supabase:{from:jest.fn((table:string)=>mockQuery(table))}}));
jest.mock('../config/environment',()=>({config:{jwtSecret:'qa-secret-for-isolated-tests-at-least-32-chars',frontendAppUrl:'https://qa.example.test'}}));
jest.mock('../services/emailService',()=>({emailService:{}}));
jest.mock('../services/aiService',()=>({aiService:{}}));
jest.mock('bcryptjs',()=>({genSalt:jest.fn(async()=>'test-salt'),hash:jest.fn(async()=>'replacement-test-hash'),compare:jest.fn(async()=>true)}));

import { authService } from '../services/authService';
import { exportService } from '../services/exportService';
import { config } from '../config/environment';
import { errorHandler } from '../middleware/errorHandler';
import questionRoutes from '../routes/questions';
import authRoutes from '../routes/auth';
import quizRoutes from '../routes/quizzes';
import { questionService } from '../services/questionService';
import { quizService } from '../services/quizService';
import { analyticsService } from '../services/analyticsService';
import { cheatingViolationService } from '../services/cheatingViolationService';

const teacher='11111111-1111-4111-8111-111111111111';
const student='22222222-2222-4222-8222-222222222222';
const questionId='33333333-3333-4333-8333-333333333333';
const session=(id:string,role:string)=>jwt.sign({id,role},config.jwtSecret,{expiresIn:'5m'});
let app:express.Express;
beforeAll(()=>{
  jest.spyOn(console,'error').mockImplementation(()=>{});
  app=express();app.use(express.json());app.use('/api/questions',questionRoutes);app.use('/api/auth',authRoutes);app.use('/api/quizzes',quizRoutes);app.use(errorHandler);
});
afterAll(()=>jest.restoreAllMocks());
beforeEach(()=>{
  jest.clearAllMocks();Object.assign(mockRows,{
    users:[{id:teacher,name:'Teacher',email:'teacher@example.test',role:'teacher',status:'active',session_version:0,password:'stored-hash',face_encoding:'sensitive',reset_password_token:'private',reset_password_expires_at:'future'},
      {id:student,name:'Student',email:'student@example.test',role:'student',status:'active',session_version:0,password:'stored-hash',face_encoding:JSON.stringify(Array(128).fill(0.1))}],
    questions:[{id:questionId,created_by:teacher,topic_id:null,correct_answer:1,correct_answers:['private']}],
  });
});

test('students sign in with a password and no biometric data',async()=>{
  delete mockRows.users[1].face_encoding;
  const result=await authService.login({email:'student@example.test',password:'StrongTest123'});
  expect(result.token).toBeTruthy();expect(result).not.toHaveProperty('tempToken');
});
test('retired face verification endpoint is unavailable',async()=>{
  expect((await request(app).post('/api/auth/verify-face-login').send({})).status).toBe(404);
});
test('profile responses use an allowlist and never return stored authentication or biometric fields',async()=>{
  const user=await authService.updateProfile(teacher,{name:'Updated'});
  expect(user.name).toBe('Updated');
  for(const key of ['password','face_encoding','reset_password_token','reset_password_expires_at'])expect(user).not.toHaveProperty(key);
});
test('foreign teachers cannot read, flag or invalidate an attempt',async()=>{
  mockRows.quiz_attempts=[{id:questionId,quiz_id:teacher,user_id:student}];
  mockRows.teacher_quizzes=[{id:teacher,teacher_id:teacher}];
  await expect(cheatingViolationService.getViolationsForAttempt(questionId,student,'teacher')).rejects.toMatchObject({statusCode:403});
  await expect(cheatingViolationService.flagAttempt(questionId,student)).rejects.toMatchObject({statusCode:403});
  await expect(cheatingViolationService.invalidateAttempt(questionId,student)).rejects.toMatchObject({statusCode:403});
  expect(mockRows.quiz_attempts[0].is_flagged).toBeUndefined();
});
test('released grades cannot be invalidated through the proctoring endpoint',async()=>{
  mockRows.quiz_attempts=[{id:questionId,quiz_id:teacher,user_id:student,results_released_at:'2026-10-18T00:00:00Z'}];
  mockRows.teacher_quizzes=[{id:teacher,teacher_id:teacher}];
  await expect(cheatingViolationService.invalidateAttempt(questionId,teacher)).rejects.toMatchObject({statusCode:409});
});
test('violation attribution comes from the owned assessment, never client-supplied teacher or quiz IDs',async()=>{
  mockRows.quiz_attempts=[{id:questionId,quiz_id:teacher,user_id:student,status:'in-progress'}];
  mockRows.teacher_quizzes=[{id:teacher,teacher_id:teacher}];
  const record=jest.spyOn(cheatingViolationService,'reportViolation').mockResolvedValueOnce({violationId:'qa',violationCount:1,autoSubmitted:false});
  try{
    const res=await request(app).post('/api/quizzes/attempts/'+questionId+'/report-violation').set('Authorization','Bearer '+session(student,'student'))
      .send({violationType:'tab_change',quizId:student,teacherId:student});
    expect(res.status).toBe(200);expect(record).toHaveBeenCalledWith(expect.objectContaining({quizId:teacher,teacherId:teacher,studentId:student}));
  }finally{record.mockRestore();}
});
test('owning teachers and students retain access to their own violation report',async()=>{
  mockRows.quiz_attempts=[{id:questionId,quiz_id:teacher,user_id:student}];mockRows.teacher_quizzes=[{id:teacher,teacher_id:teacher}];mockRows.cheating_violations=[];
  await expect(cheatingViolationService.getViolationsForAttempt(questionId,teacher,'teacher')).resolves.toEqual([]);
  await expect(cheatingViolationService.getViolationsForAttempt(questionId,student,'student')).resolves.toEqual([]);
});
test('unsupported photo uploads return actionable validation instead of a server error', async()=>{
  const res=await request(app).post('/api/auth/upload-profile-picture').set('Authorization','Bearer '+session(teacher,'teacher'))
    .attach('profilePicture',Buffer.from('not an image'),{filename:'invalid.txt',contentType:'text/plain'});
  expect(res.status).toBe(400);expect(res.body.message).toContain('JPG and PNG');
});
test('oversized photos return the documented size limit', async()=>{
  const res=await request(app).post('/api/auth/upload-profile-picture').set('Authorization','Bearer '+session(teacher,'teacher'))
    .attach('profilePicture',Buffer.alloc(3*1024*1024+1),{filename:'oversized.png',contentType:'image/png'});
  expect(res.status).toBe(413);expect(res.body.message).toContain('3MB');
});
test.each([{}, 'data:image/png;base64,bm90LWFuLWltYWdl', 'data:image/svg+xml;base64,PHN2Zz4='])('invalid registration photos fail before creating an account',async(profilePictureBase64)=>{
  await expect(authService.register({name:'QA student',email:'new@example.test',password:'StrongTest123',role:'student',profilePictureBase64})).rejects.toMatchObject({statusCode:400});
});
test.each([{email:{},password:[]},{email:'user@example.test',password:{}},{email:null,password:'anything'},{email:'x'.repeat(300),password:'anything'}])('invalid login shapes are rejected with 400',async credentials=>{
  await expect(authService.login(credentials)).rejects.toMatchObject({statusCode:400});
});
test('student sessions cannot read private bank answer keys',async()=>{
  const res=await request(app).get('/api/questions/'+questionId).set('Authorization','Bearer '+session(student,'student'));
  expect(res.status).toBe(403);expect(JSON.stringify(res.body)).not.toContain('correct_answer');
});
test('a teacher cannot read a different teacher private bank question',async()=>{
  const res=await request(app).get('/api/questions/'+questionId).set('Authorization','Bearer '+session(student,'teacher'));
  expect(res.status).toBe(403);expect(res.body.data).toBeUndefined();
});
test('question reads preserve the owning teacher access',async()=>{
  const res=await request(app).get('/api/questions/'+questionId).set('Authorization','Bearer '+session(teacher,'teacher'));
  expect(res.status).toBe(200);expect(res.body.data.correct_answer).toBe(1);
});
test('question controller forwards the authenticated _id when creating a question',async()=>{
  const create=jest.spyOn(questionService,'createQuestion').mockResolvedValueOnce({_id:questionId} as any);
  try{
    const res=await request(app).post('/api/questions').set('Authorization','Bearer '+session(teacher,'teacher')).send({topicId:teacher,questionText:'Question',questionType:'multipleChoice',difficulty:'Easy'});
    expect(res.status).toBe(201);expect(create).toHaveBeenCalledWith(expect.objectContaining({createdBy:teacher}));
  }finally{create.mockRestore();}
});
test('spreadsheet exports neutralize formulas while preserving quoted text',()=>{
  const csv=exportService.generateCSV([{studentName:'=HYPERLINK("https://invalid.test")',studentEmail:'user@example.test',quizTitle:'\t+cmd',marksObtained:1,totalMarks:1,percentage:100,submittedAt:'2026-10-18'}]);
  expect(csv).toContain("'=HYPERLINK");expect(csv).toContain("'\t+cmd");
});
test('repeated assessment submission returns a conflict without overwriting answers',async()=>{
  mockRows.quiz_attempts=[{id:questionId,user_id:student,quiz_id:teacher,status:'completed',score:1}];
  await expect(quizService.submitAllAnswers(questionId,student,[])).rejects.toMatchObject({statusCode:409});
  expect(mockRows.quiz_attempts[0].score).toBe(1);
});
test('another teacher cannot review or fetch private attempt results',async()=>{
  mockRows.quiz_attempts=[{id:questionId,user_id:student,quiz_id:teacher,status:'completed'}];
  mockRows.teacher_quizzes=[{id:teacher,teacher_id:teacher}];
  await expect(quizService.gradeSubmission(questionId,student,80,'No access')).rejects.toMatchObject({statusCode:403});
  await expect(quizService.getAttemptResults(questionId,student+'other','teacher')).rejects.toMatchObject({statusCode:403});
});
test('editing a bank question accepts answer index zero',async()=>{
  const updated=await questionService.updateQuestion(questionId,{correctAnswer:0},teacher);
  expect(updated.correct_answer).toBe(0);
});
test('teacher statistics count distinct students and include standalone owned questions',async()=>{
  mockRows.courses=[{id:'a',created_by:teacher},{id:'b',created_by:teacher}];
  mockRows.enrollments=[{course_id:'a',user_id:student},{course_id:'b',user_id:student},{course_id:'b',user_id:'other'}];
  mockRows.topics=[];mockRows.teacher_quizzes=[];
  mockRows.questions=[{created_by:teacher,topic_id:null},{created_by:teacher,topic_id:'topic'},{created_by:'other'}];
  const stats=await analyticsService.getTeacherStats(teacher);
  expect(stats).toMatchObject({totalCourses:2,totalStudents:2,activeEnrollments:3,totalQuestions:2});
});
test('only one concurrent password-reset request can consume a reset ticket',async()=>{
  const ticket='controlled-reset-ticket';
  mockRows.users[0].reset_password_token=crypto.createHash('sha256').update(ticket).digest('hex');
  mockRows.users[0].reset_password_expires_at=new Date(Date.now()+60000).toISOString();
  const results=await Promise.allSettled([authService.resetPassword(ticket,'NewControlled9'),authService.resetPassword(ticket,'OtherControlled9')]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
  expect(mockRows.users[0].reset_password_token).toBeNull();
});
test('empty profile patches are validation errors instead of database failures',async()=>{
  await expect(authService.updateProfile(teacher,{})).rejects.toMatchObject({statusCode:400});
});
test('expired signed sessions cannot enter protected question routes',async()=>{
  const expired=jwt.sign({id:teacher,role:'teacher'},config.jwtSecret,{expiresIn:-1});
  const res=await request(app).get('/api/questions/'+questionId).set('Authorization','Bearer '+expired);
  expect(res.status).toBe(401);
});
