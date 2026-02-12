import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  frontendUrl: (() => {
    const raw = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      return new URL(raw).origin;
    } catch {
      return raw;
    }
  })(),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
  resendApiKey: process.env.RESEND_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || 'AIzaSyCx29qt_w-9aIofJbS3Wyc3uBhnWLJ3sQk',
};
