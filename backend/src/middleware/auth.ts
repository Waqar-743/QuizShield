import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { authService } from '../services/authService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        role: string;
      };
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      
      console.log('Auth decoded token:', decoded);

      // Attach user info to request
      req.user = { _id: decoded.id, role: decoded.role };

      return next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user?.role} is not authorized to access this route` 
      });
    }
    next();
  };
};
