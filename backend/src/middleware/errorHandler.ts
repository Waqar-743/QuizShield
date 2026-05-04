import { Request, Response, NextFunction } from 'express';

const isProd = process.env.NODE_ENV === 'production';

// Errors whose .message is safe to surface to clients verbatim. Any other
// message at status 500 is replaced with a generic 'Server error' so that
// raw DB / supabase errors do not leak schema details to attackers.
const SAFE_400_MESSAGES = new Set<string>([
  'Invalid credentials',
  'Not authorized',
  'No token provided',
  'User not found',
]);

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  const error: any = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (err: any, req: Request, _res: Response, _next: NextFunction) => {
  // Always log the full error server-side
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err?.message || err);
  if (err?.stack && !isProd) console.error(err.stack);

  let statusCode: number = err.statusCode || 0;
  let message: string = err.message || 'Server error';

  // Map common auth/registration messages to canonical HTTP codes
  if (!statusCode) {
    if (
      message === 'Invalid credentials' ||
      message === 'Not authorized' ||
      message === 'No token provided'
    ) {
      statusCode = 401;
    } else if (message === 'User not found') {
      statusCode = 404;
    } else if (message.startsWith('Unable to register')) {
      statusCode = 409;
    } else {
      statusCode = 500;
    }
  }

  // In production, never echo raw 500 messages — they often contain DB
  // internals (constraint names, query fragments).
  if (statusCode >= 500 && isProd) {
    message = 'Server error';
  } else if (statusCode >= 400 && statusCode < 500 && isProd) {
    // 4xx is generally safe, but redact anything that looks like a stack frame
    if (message.includes('\n') || message.length > 500) {
      message = SAFE_400_MESSAGES.has(message) ? message : 'Bad request';
    }
  }

  _res.status(statusCode).json({
    success: false,
    message,
    error: { message },
    ...(isProd ? {} : { stack: err.stack }),
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
