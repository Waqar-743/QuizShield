import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const secret='admin-isolated-test-secret-over-32-characters';
let mockAccount:any;
jest.mock('../config/environment',()=>({config:{jwtSecret:'admin-isolated-test-secret-over-32-characters',automationRecipients:[]}}));
jest.mock('../config/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:mockAccount,error:null})})})})}}));
jest.mock('../services/emailService',()=>({emailService:{}}));
import routes from '../routes/admin';
import { protect,authorize } from '../middleware/auth';
let app:express.Express;
beforeAll(()=>{app=express();app.use(express.json());app.use('/admin',routes);app.get('/teacher',protect,authorize('teacher'),(_q,s)=>s.json({ok:true}));app.get('/current',protect,(q,s)=>s.json({role:q.user!.role}));});
beforeEach(()=>{mockAccount={id:'11111111-1111-4111-8111-111111111111',role:'student',status:'active',session_version:0};});
const auth=(role:string,version=0)=>'Bearer '+jwt.sign({id:mockAccount.id,role,version},secret);
test.each(['student','teacher'])('current %s cannot call any administrative mutation or read',async role=>{
 mockAccount.role=role;
 for(const [method,url] of [['get','/admin/overview'],['get','/admin/accounts'],['patch','/admin/accounts/11111111-1111-4111-8111-111111111111'],['post','/admin/accounts'],['get','/admin/audit'],['post','/admin/automations/11111111-1111-4111-8111-111111111111/setup'],['post','/admin/jobs/11111111-1111-4111-8111-111111111111/retry']]){
  const res=await (request(app) as any)[method](url).set('Authorization',auth('admin')).send({});
  expect(res.status).toBe(403);
 }
});
test('current database role overrides a still-signed elevated claim',async()=>{
 expect((await request(app).get('/current').set('Authorization',auth('admin'))).body.role).toBe('student');
 expect((await request(app).get('/teacher').set('Authorization',auth('teacher'))).status).toBe(403);
});
test.each(['suspended','deactivated','invited'])('%s accounts lose existing sessions',async status=>{
 mockAccount.status=status;expect((await request(app).get('/current').set('Authorization',auth('admin'))).status).toBe(401);
});
test('session version changes revoke a formerly valid token',async()=>{
 const token=auth('student');mockAccount.session_version=1;
 expect((await request(app).get('/current').set('Authorization',token)).status).toBe(401);
});
test('authentication never accepts temporary or missing session tokens',async()=>{
 expect((await request(app).get('/admin/overview')).status).toBe(401);
 const token=jwt.sign({id:mockAccount.id,role:'admin',type:'temporary'},secret);
 expect((await request(app).get('/current').set('Authorization','Bearer '+token)).status).toBe(401);
});
