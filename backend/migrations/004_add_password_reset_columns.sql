-- Add password reset token support for forgot-password flow
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_reset_password_token ON users(reset_password_token);
