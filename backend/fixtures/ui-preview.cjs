// Isolated, in-memory UI fixture. No Supabase, Fastn, Resend, or real recipients.
const express = require('express');
const app = express();
app.use(require('cors')()); app.use(express.json());
const previewStudent=process.argv.includes('--student');
const user = { _id:previewStudent?'student':'teacher',name:previewStudent?'Preview student':'Preview teacher',email:'preview@example.test',role:previewStudent?'student':'teacher' };
let settings = { ...require('../dist/src/services/automationPolicy').defaultAutomationSettings };
const quizzes = [{_id:'quiz',title:'October assessment',description:'Controlled UI preview',courseId:'course',courseTitle:'Test course',timeLimit:30,questions:[{text:'What is 2+2?',options:['4','5'],correctAnswer:0,difficulty:'Easy',timeLimit:60}],accessCode:'2468',scheduledStart:'2026-10-25T05:00:00Z',closesAt:'2026-10-25T07:00:00Z',timezone:'Asia/Karachi',lifecycle:'draft',createdAt:new Date().toISOString()}];
app.post('/api/auth/login',(_req,res)=>res.json({success:true,data:{user,token:'local-ui-preview-only'}}));
app.get('/api/auth/me',(_req,res)=>res.json({success:true,data:user}));
app.get('/api/automations/settings',(_req,res)=>res.json({success:true,data:{settings,connection:{calendar_connected:false,sheets_connected:false},deliveryEnabled:false,fastnConfigured:false,resendConfigured:false,controlledRecipients:true}}));
app.put('/api/automations/settings',(req,res)=>{settings={...settings,...req.body};res.json({success:true,data:settings});});
app.get('/api/automations/history',(_req,res)=>res.json({success:true,data:[
  {id:'pending',kind:'reminder',channel:'email',status:'pending',attempts:0,run_at:'2026-10-24T07:00:00Z'},
  {id:'failed',kind:'calendar',channel:'fastn',status:'failed',attempts:1,run_at:new Date().toISOString(),last_error:'Live Fastn delivery is not configured'},
  {id:'uncertain',kind:'results',channel:'email',status:'uncertain',attempts:1,run_at:new Date().toISOString(),last_error:'Reconcile delivery before retry'},
]}));
app.get('/api/quizzes/teacher/my-quizzes',(_req,res)=>res.json({success:true,data:quizzes}));
app.get('/api/courses/teacher/my-courses',(_req,res)=>res.json({success:true,data:[{_id:'course',title:'Test course'}]}));
app.get('/api/automations/courses/course/students',(_req,res)=>res.json({success:true,data:[{id:'student',name:'Controlled student',email:'student@example.test'}]}));
app.get('/api/notifications',(_req,res)=>res.json({success:true,data:[]}));
app.get('/api/quizzes/student/analytics',(_req,res)=>res.json({success:true,data:{totalQuizzes:0,avgScore:0,passRate:0,streakDays:0,performanceData:[]}}));
app.get('/api/quizzes/history',(_req,res)=>process.argv.includes('--fail-history')?res.status(503).json({success:false,message:'Controlled preview failure'}):res.json({success:true,data:[]}));
app.get('*',(_req,res)=>res.json({success:true,data:[]}));
app.listen(5556,'127.0.0.1',()=>console.log('Isolated UI fixture ready at http://127.0.0.1:5556'));
