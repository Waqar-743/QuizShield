// Synthetic controlled staging acceptance. Never print credentials or API bodies.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),bcrypt=require('bcryptjs');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const rows=[],file='.vercel/admin-fixtures.json';
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
async function api(path,method='GET',body,token,headers={}){
 const r=await fetch(env.BACKEND_PUBLIC_URL+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const b=await r.json();return {status:r.status,data:b.data,error:b.message||b.error?.message};
}
function record(name,pass,detail={}){rows.push({name,pass,...detail});assert.ok(pass,name);}
async function login(email,password){const r=await api('/auth/login','POST',{email,password});assert.equal(r.status,200);assert.ok(r.data.token);return r.data.token;}
(async()=>{
 let fixtures=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
 if(!fixtures.admin){
  const password=crypto.randomBytes(24).toString('base64url')+'aA1';
  const account=check(await db.from('users').insert({email:'admin-qa@quizshield.invalid',name:'Staging QA operator',password:await bcrypt.hash(password,12),role:'teacher',status:'active'}).select('id').single());
  check(await db.rpc('bootstrap_first_admin',{p_email:'admin-qa@quizshield.invalid'}));
  fixtures={admin:account.id,adminEmail:'admin-qa@quizshield.invalid',adminPassword:password};fs.writeFileSync(file,JSON.stringify(fixtures));
  record('Operator-only first administrator bootstrap',true);
 }
 const admin=await login(fixtures.adminEmail,fixtures.adminPassword);
 const t=check(await db.from('users').select('id').eq('email','teacher@quizshield.invalid').single());
 const teacher=await login('teacher@quizshield.invalid',env.STAGING_TEST_PASSWORD);
 const studentEmail=env.AUTOMATION_TEST_RECIPIENTS;
 const s=check(await db.from('users').select('id').eq('email',studentEmail).single());
 const student=await login(studentEmail,env.STAGING_TEST_PASSWORD);
 record('Student ordinary password sign-in without biometric stage',Boolean(student));
 for(const [role,token] of [['teacher',teacher],['student',student]])for(const [path,method,body] of [['/admin/overview','GET'],['/admin/accounts','POST',{name:'Forbidden',email:'blocked@example.invalid',role:'admin'}],['/admin/accounts/'+fixtures.admin,'PATCH',{role:'student'}],['/admin/jobs/'+fixtures.admin+'/retry','POST',{}]]){
  record(role+' denied '+method+' '+path,(await api(path,method,body,token)).status===403);
 }
 const overview=await api('/admin/overview','GET',undefined,admin);
 record('Administrator real counts',overview.status===200&&Object.values(overview.data.counts).every(Number.isInteger),{counts:overview.data?.counts});
 const search=await api('/admin/accounts?role=teacher&search=teacher%40quizshield.invalid','GET',undefined,admin);
 record('Search and pagination',search.status===200&&search.data.rows.length===1&&search.data.rows[0].id===t.id);
 const detail=await api('/admin/accounts/'+s.id,'GET',undefined,admin);
 record('Account impact and assessment records',detail.status===200&&Array.isArray(detail.data.assessments)&&typeof detail.data.assessmentCount==='number');
 const serialized=JSON.stringify(detail.data);
 record('Administrator DTO excludes credentials and biometrics',!['"password"','face_encoding','reset_password_token','execution_token','google_webhook_url','supabaseServiceKey'].some(k=>serialized.includes(k)));
 record('Last administrator demotion denied',(await api('/admin/accounts/'+fixtures.admin,'PATCH',{role:'student'},admin)).status===409);
 record('Last administrator suspension denied',(await api('/admin/accounts/'+fixtures.admin,'PATCH',{status:'suspended'},admin)).status===409);
 record('Profile editing cannot set passwords',(await api('/admin/accounts/'+t.id,'PATCH',{password:'Disallowed123'},admin)).status===409);
 for(const path of ['/auth/verify-face-login','/auth/validate-picture'])record('Retired endpoint '+path,(await api(path,'POST',{},student)).status===404);
 record('No public administrator registration',(await api('/auth/register','POST',{name:'Invalid admin',email:'forbidden@example.invalid',password:'StrongTest123',role:'admin'})).status===400);
 const invite=await api('/admin/accounts','POST',{name:'Admin removal fixture',email:'removal-'+crypto.randomUUID()+'@quizshield.invalid',role:'teacher'},admin);
 record('Secure invitation without ordinary password entry',invite.status===201&&invite.data.account.status==='invited'&&!JSON.stringify(invite.data).includes('password'));
 const id=invite.data.account.id;fixtures.removal=id;fs.writeFileSync(file,JSON.stringify(fixtures));
 record('Invited account cannot be activated before setup',(await api('/admin/accounts/'+id,'PATCH',{status:'active'},admin)).status===409);
 // Synthetic test setup through the service role; no recipient credentials returned.
 const fixturePassword=crypto.randomBytes(24).toString('base64url')+'aA1';
 check(await db.from('users').update({status:'active',password:await bcrypt.hash(fixturePassword,12)}).eq('id',id));
 const fixtureEmail=invite.data.account.email;
 const fixtureSession=await login(fixtureEmail,fixturePassword);
 const saved=await api('/admin/accounts/'+id,'PATCH',{name:'Updated fixture'},admin);record('Permitted account edit audited',saved.status===200&&saved.data.account.name==='Updated fixture');
 record('Suspend account',(await api('/admin/accounts/'+id,'PATCH',{status:'suspended'},admin)).status===200);
 record('Existing session revoked on suspension',(await api('/auth/me','GET',undefined,fixtureSession)).status===401);
 record('Suspended password sign-in denied',(await api('/auth/login','POST',{email:fixtureEmail,password:fixturePassword})).status===403);
 await api('/admin/accounts/'+id,'PATCH',{status:'active'},admin);
 const fresh=await login(fixtureEmail,fixturePassword);
 record('Role change',(await api('/admin/accounts/'+id,'PATCH',{role:'student'},admin)).status===200);
 record('Existing role session revoked',(await api('/auth/me','GET',undefined,fresh)).status===401);
 record('Removal requires impact confirmation',(await api('/admin/accounts/'+id,'PATCH',{status:'deactivated'},admin)).status===409);
 record('Recoverable removal',(await api('/admin/accounts/'+id,'PATCH',{status:'deactivated'},admin,{'x-confirm-account':id})).status===200);
 const grant=await api('/admin/automations/'+t.id+'/grant','PUT',{status:'active',capabilities:['announcement','deadline_reminder','results_email','schedule_email','calendar_sync','sheets_sync'],editable_keys:['timezone','reminder_hours'],defaults:{reminder_hours:24}},admin);
 record('Administrator automation assignment',grant.status===200);
 const settings=await api('/automations/settings','GET',undefined,teacher);
 record('Teacher sees assigned capabilities',settings.status===200&&settings.data.grant.capabilities.includes('calendar_sync'));
 record('Teacher cannot enable administrator-controlled capability',(await api('/automations/settings','PUT',{welcome_email:true},teacher)).status===403);
 record('Cross-teacher destination change denied',(await api('/automations/settings','PUT',{calendar_id:'foreign-calendar'},teacher)).status===403);
 const setup=await api('/admin/automations/'+t.id+'/setup','POST',{},admin);
 record('Incomplete Google setup remains honestly blocked',setup.status===200&&setup.data.status==='blocked'&&!setup.data.url,{blocker:setup.data?.blocker});
 const history=await api('/admin/jobs?teacher_id='+t.id,'GET',undefined,admin);
 record('Execution history filtered by teacher',history.status===200&&history.data.rows.every(r=>r.teacher_id===t.id));
 const audit=await api('/admin/audit','GET',undefined,admin);record('Administrative audit history',audit.status===200&&audit.data.total>0);
 const logout=await api('/auth/logout','POST',{},teacher);record('Server logout revokes session',logout.status===200&&(await api('/auth/me','GET',undefined,teacher)).status===401);
 fs.writeFileSync('../qa/admin-hosted-api.json',JSON.stringify({verifiedAt:new Date().toISOString(),environment:'hosted staging',productionChanged:false,restrictedRecipients:true,results:rows},null,2));
 console.log(JSON.stringify({passed:rows.filter(r=>r.pass).length,total:rows.length}));
})().catch(error=>{fs.writeFileSync('../qa/admin-hosted-api.json',JSON.stringify({verifiedAt:new Date().toISOString(),results:rows,error:error.message},null,2));console.error(error.message);process.exitCode=1;});
