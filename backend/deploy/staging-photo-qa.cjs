// Real hosted privacy check with a generated one-pixel PNG, never a person's photo.
const fs=require('fs'),assert=require('node:assert/strict');
const env=require('dotenv').parse(fs.readFileSync('.env.staging.local'));
assert.equal(env.SUPABASE_URL,'https://jixzholamkbktzusyqwe.supabase.co');
assert.equal(env.BACKEND_PUBLIC_URL,'https://quizshield-automation-staging.vercel.app');
const db=require('@supabase/supabase-js').createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const ids=JSON.parse(fs.readFileSync('.vercel/staging-fixtures.json'));
const checked=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function api(path,options={}){
  const r=await fetch(env.BACKEND_PUBLIC_URL+path,{...options,signal:AbortSignal.timeout(25000)});
  return {status:r.status,body:await r.json()};
}
async function main(){
  const before=checked(await db.from('users').select('profile_picture_url').eq('id',ids.teacher).single());
  const results=[];let key;
  try{
    assert.equal(checked(await db.storage.getBucket('profile-pictures')).public,false);
    const login=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'teacher@quizshield.invalid',password:env.STAGING_TEST_PASSWORD})});
    assert.equal(login.status,200);const token=login.body.data.token;
    const form=new FormData();form.append('profilePicture',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6FYAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'generated.png');
    const uploaded=await api('/api/auth/upload-profile-picture',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
    assert.equal(uploaded.status,200);const signed=uploaded.body.data.profilePictureUrl;
    key=checked(await db.from('users').select('profile_picture_url').eq('id',ids.teacher).single()).profile_picture_url;
    assert.ok(key.startsWith(ids.teacher+'/'));assert.ok(!key.includes('://'));
    const publicResponse=await fetch(env.SUPABASE_URL+'/storage/v1/object/public/profile-pictures/'+key);
    assert.ok([400,403,404].includes(publicResponse.status));
    const signedResponse=await fetch(signed);assert.equal(signedResponse.status,200);
    const claims=JSON.parse(Buffer.from(new URL(signed).searchParams.get('token').split('.')[1],'base64url'));
    assert.equal(claims.exp-claims.iat,3600);
    results.push({id:'PHOTO-PRIVATE',pass:true,bucketPublic:false,publicHttp:publicResponse.status,signedHttp:signedResponse.status,signedLifetimeSeconds:3600,generatedNonBiometricImage:true});
    const me=await api('/api/auth/me',{headers:{Authorization:'Bearer '+token}});
    assert.equal(me.status,200);assert.ok(me.body.data.profilePictureUrl.includes('/object/sign/'));
    assert.ok(!Object.keys(me.body.data).some(k=>/password|face_encoding|reset_password/.test(k)));
    results.push({id:'PHOTO-PROFILE-RELOAD',pass:true,profileHttp:200,signedLinkReturned:true,privateFieldsAbsent:true});
    const unauth=await api('/api/auth/upload-profile-picture',{method:'POST',body:new FormData()});
    assert.equal(unauth.status,401);results.push({id:'PHOTO-AUTH',pass:true,httpStatus:401});
    for(const [id,type,bytes,status] of [['PHOTO-TYPE','text/plain',Buffer.from('invalid'),400],['PHOTO-SIZE','image/png',Buffer.alloc(3*1024*1024+1),413]]){
      const invalid=new FormData();invalid.append('profilePicture',new Blob([bytes],{type}),'invalid');
      const response=await api('/api/auth/upload-profile-picture',{method:'POST',headers:{Authorization:'Bearer '+token},body:invalid});
      assert.equal(response.status,status);results.push({id,pass:true,httpStatus:response.status,message:response.body.message});
    }
  }finally{
    checked(await db.from('users').update({profile_picture_url:before.profile_picture_url}).eq('id',ids.teacher));
    if(key)checked(await db.storage.from('profile-pictures').remove([key]));
  }
  const evidence={verifiedAt:new Date().toISOString(),environment:'hosted-staging',results,cleanup:'Original profile metadata restored; generated private object removed'};
  fs.writeFileSync('../qa/photo-privacy.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
