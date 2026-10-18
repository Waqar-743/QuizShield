// Restore controlled QA preferences and remove pending test side effects, never production data.
const fs=require('fs'),assert=require('node:assert/strict');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
assert.equal(env.AUTOMATION_ALLOW_ALL_RECIPIENTS,'false');
assert.equal(env.AUTOMATION_TEST_RECIPIENTS,'joinwaqarahmed@gmail.com');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const ids=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json'));
const checked=r=>{if(r.error)throw Error(r.error.message);return r.data;};
(async()=>{
 const teacher=checked(await db.from('users').select('email').eq('id',ids.teacher).single());assert.equal(teacher.email,'teacher@quizshield.invalid');
 const active=checked(await db.from('teacher_quizzes').select('id').eq('teacher_id',ids.teacher).eq('lifecycle','published'));assert.equal(active.length,0,'Cancel controlled assessments before restoring notification preferences');
 const cancelled=checked(await db.from('automation_jobs').update({status:'cancelled',last_error:'Controlled full-QA cleanup',execution_token:null,lease_until:null}).eq('teacher_id',ids.teacher).in('status',['pending','running','awaiting','failed']).select('id'));
 checked(await db.from('automation_jobs').update({execution_token:null,lease_until:null}).eq('teacher_id',ids.teacher).in('status',['succeeded','cancelled']));
 const original=JSON.parse(fs.readFileSync('.vercel/qa-original-settings.json'));delete original.updated_at;
 const login=await fetch(env.BACKEND_PUBLIC_URL+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:teacher.email,password:env.STAGING_TEST_PASSWORD})}).then(r=>r.json());
 const restored=await fetch(env.BACKEND_PUBLIC_URL+'/api/automations/settings',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+login.data.token},body:JSON.stringify(original)});assert.equal(restored.status,200);
 const after=checked(await db.from('automation_settings').select('*').eq('teacher_id',ids.teacher).single());
 assert.ok(Object.entries(original).every(([k,v])=>after[k]===v));
 const outstanding=checked(await db.from('automation_jobs').select('status').in('status',['pending','running','awaiting','failed','uncertain']));
 const bucket=checked(await db.storage.getBucket('profile-pictures'));assert.equal(bucket.public,false);
 let text=fs.readFileSync('.env.staging.local','utf8');const removed=[];
 text=text.replace(/^((?:STAGING_CALLBACK_INPUT|STAGING_GOOGLE[^=\r\n]*INPUT|STAGING_EMAIL[^=\r\n]*INPUT))=.*\r?\n/gm,(_,key)=>{removed.push(key);return '';});
 fs.writeFileSync('.env.staging.local',text);
 // Remove controlled access-code text from the distributable DOM snapshots.
 const courses=checked(await db.from('courses').select('course_code'));
 const quizzes=checked(await db.from('teacher_quizzes').select('access_code'));
 const codes=[...courses.map(c=>c.course_code),...quizzes.map(q=>q.access_code)].filter(Boolean);
 const path='../qa/browser-desktop.json',observations=JSON.parse(fs.readFileSync(path));
 for(const o of observations){if(typeof o.text!=='string')continue;for(const code of codes)o.text=o.text.replace(new RegExp('\\b'+code+'\\b','gi'),'[controlled code]');}
 fs.writeFileSync(path,JSON.stringify(observations,null,2));
 const report={verifiedAt:new Date().toISOString(),stagingOnly:true,originalPreferencesRestored:true,publishedFixtureQuizzes:0,cancelledPendingFixtureJobs:cancelled.length,outstandingGlobalJobs:outstanding.length,outstandingStatuses:[...new Set(outstanding.map(x=>x.status))],profileBucketPublic:bucket.public,temporaryEnvironmentInputsRemovedThisRun:removed,temporaryEnvironmentInputsAbsent:!/^STAGING_(?:CALLBACK_INPUT|GOOGLE[^=\r\n]*INPUT|EMAIL[^=\r\n]*INPUT)=/m.test(text),allowAllRecipients:false,approvedRecipientCount:1,sheetsAuditRowsRetained:true,fixtureAccountsRetained:true};
 fs.writeFileSync('../qa/cleanup.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(outstanding.length,0,'Inspect outstanding jobs; do not claim cleanup passed');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
