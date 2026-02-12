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
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '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',
  openRouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  openRouterAppUrl: process.env.OPENROUTER_APP_URL || process.env.FRONTEND_URL || '',
  openRouterAppName: process.env.OPENROUTER_APP_NAME || 'QuizShield',
};
