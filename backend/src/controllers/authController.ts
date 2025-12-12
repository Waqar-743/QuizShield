import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { asyncHandler } from '../middleware/errorHandler';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  
  res.status(201).json({
    success: true,
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  // req.user is attached by auth middleware
  const user = await authService.getCurrentUser(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.user!._id.toString(), req.body);
  
  res.status(200).json({
    success: true,
    data: user,
  });
});

export const switchRole = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !['student', 'teacher'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role. Must be "student" or "teacher"' });
  }
  
  const result = await authService.switchRole(req.user!._id.toString(), role);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});
