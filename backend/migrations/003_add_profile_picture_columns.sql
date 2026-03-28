-- Add profile picture and face encoding columns for face recognition verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_encoding TEXT;

-- Create storage bucket for profile pictures (run via Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('profile-pictures', 'profile-pictures', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/jpg'])
-- ON CONFLICT (id) DO NOTHING;
