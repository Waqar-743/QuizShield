import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import quizRoutes from './routes/quizzes';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import questionRoutes from './routes/questions';
import notificationRoutes from './routes/notifications';

const app = express();

// Trust proxy (Vercel/Cloudflare) — required for correct req.ip in rate limiters
app.set('trust proxy', 1);

// Security headers — disable CSP since this is an API (frontend on separate origin)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

connectDatabase();

// ---------------------------------------------------------------------------
// CORS — strict exact-match only (no startsWith to prevent subdomain spoofing)
// ---------------------------------------------------------------------------
const allowedOrigins = new Set([
  config.frontendUrl,
  'https://waqar-743.github.io',
  'https://quiz-shield.vercel.app',
  'https://quizshield-578fa6.gitlab.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isGitLabPages = /^https:\/\/[a-z0-9-]+\.gitlab\.io$/i.test(origin);
    if (allowedOrigins.has(origin) || isGitLabPages) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
}));

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
// 10mb is wide enough for face encodings + base64 profile pictures used during
// registration. Tighten if those flows move to multipart uploads.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ---------------------------------------------------------------------------
// Logging — redact tokens from URLs in production
// ---------------------------------------------------------------------------
const morganFormat = config.nodeEnv === 'development' ? 'dev' : 'tiny';
app.use(morgan(morganFormat, {
  stream: {
    write: (msg: string) =>
      process.stdout.write(
        msg
          .replace(/token=[^&\s"]+/gi, 'token=[REDACTED]')
          .replace(/code=[^&\s"]+/gi, 'code=[REDACTED]')
          .replace(/password=[^&\s"]+/gi, 'password=[REDACTED]'),
      ),
  },
}));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts. Please try again in 15 minutes.' } },
});

const faceVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many face verification attempts. Please try again in 15 minutes.' } },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many password reset requests. Please try again in an hour.' } },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many AI requests. Please slow down.' } },
});

const violationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?._id || req.ip || 'unknown',
  message: { success: false, error: { message: 'Violation report rate limit exceeded.' } },
});

// Apply targeted rate limits before routes
app.use('/api/auth/login', authLoginLimiter);
app.use('/api/auth/verify-face-login', faceVerifyLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/quizzes/attempts', violationLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/notifications', notificationRoutes);

// ---------------------------------------------------------------------------
// Health check — verifies DB reachability
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  try {
    const { supabase } = await import('./config/supabase');
    const { error } = await supabase.from('users').select('id').limit(1);
    checks.database = error ? 'degraded' : 'ok';
  } catch {
    checks.database = 'degraded';
  }

  checks.ai = config.geminiApiKey ? 'ok' : 'degraded';

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'QuizShield API is running',
    environment: config.nodeEnv,
    version: '1.0.0',
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Server startup (skipped in Vercel serverless)
// ---------------------------------------------------------------------------
if (process.env.VERCEL !== '1') {
  const PORT = config.port;
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  });

  server.on('error', (error) => {
    console.error('FATAL: Server failed to start:', error);
    process.exit(1);
  });
}

process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION:', err?.name, err?.message);
  if (process.env.VERCEL !== '1') process.exit(1);
});

export default app;
