import { supabase } from '../config/supabase';
import { config } from '../config/environment';
import crypto from 'crypto';

const BUCKET_NAME='profile-pictures';
// Base64 registration adds one third to the payload; stay below the host's 4.5 MB request cap.
const MAX_FILE_SIZE=3*1024*1024;
const ALLOWED_TYPES=['image/jpeg','image/png','image/jpg'];
const httpError=(message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});

async function ensurePrivateBucket() {
  const {data:buckets,error}=await supabase.storage.listBuckets();
  if(error) throw httpError('Photo storage is temporarily unavailable',503);
  const bucket=buckets?.find(b=>b.name===BUCKET_NAME);
  if(bucket?.public) throw httpError('Private photo storage must be configured before uploads are enabled',503);
  if(!bucket){
    const {error:createError}=await supabase.storage.createBucket(BUCKET_NAME,{public:false,fileSizeLimit:MAX_FILE_SIZE,allowedMimeTypes:ALLOWED_TYPES});
    if(createError) throw httpError('Photo storage is temporarily unavailable',503);
  }
}
function ownedPictureKey(value:string,userId:string):string|null {
  let key=value;
  if(/^https?:\/\//i.test(value)){
    try{
      const url=new URL(value);
      if(url.origin!==new URL(config.supabaseUrl).origin) return null;
      const prefix=/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/profile-pictures\//;
      if(!prefix.test(url.pathname)) return null;
      key=decodeURIComponent(url.pathname.replace(prefix,''));
    }catch{return null;}
  }
  if(!key.startsWith(userId+'/') || !/^[a-f0-9-]+\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png)$/.test(key)) return null;
  return key;
}

export const profilePictureService={
  validateFile(file:Express.Multer.File){
    if(!file) throw httpError('No file provided');
    if(!ALLOWED_TYPES.includes(file.mimetype)) throw httpError('Invalid file type. Only JPG and PNG are allowed.');
    if(file.size>MAX_FILE_SIZE || file.buffer.length>MAX_FILE_SIZE) throw httpError('File too large. Maximum size is 3MB.');
    const png=file.buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg=file.buffer.length>=3 && file.buffer[0]===255 && file.buffer[1]===216 && file.buffer[2]===255;
    if(file.mimetype==='image/png'?!png:!jpeg) throw httpError('The file content must match its JPG or PNG image type.');
  },
  async uploadProfilePicture(userId:string,file:Express.Multer.File):Promise<string>{
    this.validateFile(file);
    await ensurePrivateBucket();
    const key=userId+'/'+crypto.randomBytes(16).toString('hex')+(file.mimetype==='image/png'?'.png':'.jpg');
    const {error}=await supabase.storage.from(BUCKET_NAME).upload(key,file.buffer,{contentType:file.mimetype,upsert:false});
    if(error) throw httpError('Photo upload failed. Please try again.',503);
    // Do not delete an existing picture before both upload and metadata save succeed.
    // Replaced private objects are retained for the administrator's retention policy.
    return key;
  },
  async signedProfilePictureUrl(value:string|undefined|null,userId:string):Promise<string|undefined>{
    if(!value) return undefined;
    const key=ownedPictureKey(value,userId);
    if(!key) return undefined;
    const {data,error}=await supabase.storage.from(BUCKET_NAME).createSignedUrl(key,3600);
    if(error || !data?.signedUrl) throw httpError('Photo is temporarily unavailable',503);
    return data.signedUrl;
  },
  async saveProfilePictureUrl(userId:string,key:string){
    if(ownedPictureKey(key,userId)!==key) throw httpError('Invalid picture reference');
    const {error}=await supabase.from('users').update({profile_picture_url:key}).eq('id',userId);
    if(error) throw httpError('Photo metadata could not be saved',503);
  },

};
