import { Request, Response, NextFunction } from 'express';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Determine status code from error message or default to 500
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Map common error messages to appropriate status codes
  const message = err.message || 'Server error';
  if (message === 'Invalid credentials' || message === 'Not authorized' || message === 'No token provided') {
    statusCode = 401;
  } else if (message === 'User already exists' || message === 'User not found') {
    statusCode = 400;
  }
  
  res.status(statusCode);
  res.json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
