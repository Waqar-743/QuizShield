import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { asyncHandler } from '../middleware/errorHandler';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await analyticsService.getDashboardStats(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: stats,
  });
});

// Placeholder for other analytics methods not yet implemented in Supabase service
export const getCourseAnalytics = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: {} });
});

export const getWeakTopics = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

export const getProgressOverTime = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

// ============ Teacher Analytics Controllers ============

export const getTeacherStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await analyticsService.getTeacherStats(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: stats,
  });
});

export const getTeacherCoursePerformance = asyncHandler(async (req: Request, res: Response) => {
  const performance = await analyticsService.getTeacherCoursePerformance(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: performance,
  });
});

export const getTeacherCourseAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await analyticsService.getTeacherCourseAnalytics(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: analytics,
  });
});

export const getTeacherTimeSeries = asyncHandler(async (req: Request, res: Response) => {
  const range = (req.query.range as string) || '30d';
  const timeSeries = await analyticsService.getTeacherTimeSeries(req.user!._id.toString(), range);
  
  res.status(200).json({
    success: true,
    data: timeSeries,
  });
});

export const getTeacherCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await analyticsService.getTeacherCourses(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: courses,
  });
});

export const getTeacherTopics = asyncHandler(async (req: Request, res: Response) => {
  const topics = await analyticsService.getTeacherTopics(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: topics,
  });
});

export const getTeacherQuestions = asyncHandler(async (req: Request, res: Response) => {
  const questions = await analyticsService.getTeacherQuestions(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: questions,
  });
});
