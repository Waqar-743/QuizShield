import { supabase } from '../config/supabase';
import path from 'path';
import crypto from 'crypto';

const BUCKET_NAME = 'profile-pictures';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

async function ensureBucketExists() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Failed to create storage bucket:', error.message);
    }
  }
}

// Ensure bucket on module load
ensureBucketExists().catch(console.error);

export const profilePictureService = {
  validateFile(file: Express.Multer.File) {
    if (!file) throw new Error('No file provided');
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPG and PNG are allowed.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum size is 5MB.');
    }
  },

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const hash = crypto.randomBytes(8).toString('hex');
    const filePath = `${userId}/${hash}${ext}`;

    // Delete old pictures for this user
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId);

    if (existingFiles && existingFiles.length > 0) {
      const pathsToDelete = existingFiles.map(f => `${userId}/${f.name}`);
      await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete);
    }

    // Upload new picture
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  },

  async saveProfilePictureUrl(userId: string, url: string) {
    const { error } = await supabase
      .from('users')
      .update({ profile_picture_url: url })
      .eq('id', userId);

    if (error) throw new Error(`Failed to save profile picture URL: ${error.message}`);
  },

  async saveFaceEncoding(userId: string, encoding: string) {
    const { error } = await supabase
      .from('users')
      .update({ face_encoding: encoding })
      .eq('id', userId);

    if (error) throw new Error(`Failed to save face encoding: ${error.message}`);
  },
};
