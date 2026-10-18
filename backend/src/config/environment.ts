import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// On Vercel, env vars are injected directly — dotenv is a no-op.
// Locally, try .env first, then fall back to .env.local (created by `vercel env pull`).
if (process.env.VERCEL !== '1') {
  const envPath = path.resolve(process.cwd(), '.env');
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }
}

function requireEnv(name: string, minLength = 1): string {
  const val = process.env[name];
  if (!val || val.trim().length < minLength) {
    throw new Error(`FATAL: Environment variable "${name}" is missing or too short. Server will not start.`);
  }
  return val.trim();
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  frontendAppUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  frontendUrl: (() => {
    const raw = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      return new URL(raw).origin;
    } catch {
      return raw;
    }
  })(),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseKey: requireEnv('SUPABASE_KEY'),
  supabaseServiceKey: process.env.NODE_ENV === 'production'
    ? requireEnv('SUPABASE_SERVICE_KEY')
    : process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '',
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters long. Server will not start.');
    }
    return secret;
  })(),
  resendApiKey: process.env.RESEND_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  automationLive: process.env.AUTOMATION_LIVE === 'true',
  automationGoogleEnabled: process.env.AUTOMATION_GOOGLE_ENABLED === 'true',
  automationAllowAll: process.env.AUTOMATION_ALLOW_ALL_RECIPIENTS === 'true',
  automationRecipients: (process.env.AUTOMATION_TEST_RECIPIENTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  automationWorkerSecret: process.env.AUTOMATION_WORKER_SECRET || '',
  fastnWebhookUrl: process.env.FASTN_WEBHOOK_URL || '',
  fastnAccessKey: process.env.FASTN_ACCESS_KEY || '',
  backendPublicUrl: (process.env.BACKEND_PUBLIC_URL || '').replace(/\/$/, ''),
  emailFrom: process.env.EMAIL_FROM || 'QuizShield <onboarding@resend.dev>',
};
