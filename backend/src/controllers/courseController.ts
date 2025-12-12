import { Request, Response } from 'express';
import { courseService } from '../services/courseService';
import { asyncHandler } from '../middleware/errorHandler';

// ============ Course Controllers (Student) ============

export const getCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await courseService.getAllCourses(req.query);
  
  res.status(200).json({
    success: true,
    data: courses,
  });
});

export const getCourseById = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.getCourseById(req.params.id);
  
  res.status(200).json({
    success: true,
    data: course,
  });
});

export const enrollInCourse = asyncHandler(async (req: Request, res: Response) => {
  const result = await courseService.enrollCourse(req.user!._id.toString(), req.params.id);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getEnrolledCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await courseService.getEnrolledCourses(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: courses,
  });
});

// ============ Course Controllers (Teacher) ============

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  console.log('createCourse called by user:', req.user);
  console.log('Request body:', req.body);
  
  const course = await courseService.createCourse(req.user!._id.toString(), req.body);
  
  res.status(201).json({
    success: true,
    data: course,
  });
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await courseService.updateCourse(req.user!._id.toString(), req.params.id, req.body);
  
  res.status(200).json({
    success: true,
    data: course,
  });
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const result = await courseService.deleteCourse(req.user!._id.toString(), req.params.id);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============ Topic Controllers (Teacher) ============

export const getTopicsByCourse = asyncHandler(async (req: Request, res: Response) => {
  const topics = await courseService.getTopicsByCourse(req.params.courseId);
  
  res.status(200).json({
    success: true,
    data: topics,
  });
});

export const createTopic = asyncHandler(async (req: Request, res: Response) => {
  const topic = await courseService.createTopic(req.user!._id.toString(), req.body);
  
  res.status(201).json({
    success: true,
    data: topic,
  });
});

export const updateTopic = asyncHandler(async (req: Request, res: Response) => {
  const topic = await courseService.updateTopic(req.user!._id.toString(), req.params.id, req.body);
  
  res.status(200).json({
    success: true,
    data: topic,
  });
});

export const deleteTopic = asyncHandler(async (req: Request, res: Response) => {
  const result = await courseService.deleteTopic(req.user!._id.toString(), req.params.id);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============ Question Controllers (Teacher) ============

export const getQuestionsByTopic = asyncHandler(async (req: Request, res: Response) => {
  const questions = await courseService.getQuestionsByTopic(req.params.topicId);
  
  res.status(200).json({
    success: true,
    data: questions,
  });
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await courseService.createQuestion(req.user!._id.toString(), req.body);
  
  res.status(201).json({
    success: true,
    data: question,
  });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await courseService.updateQuestion(req.user!._id.toString(), req.params.id, req.body);
  
  res.status(200).json({
    success: true,
    data: question,
  });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const result = await courseService.deleteQuestion(req.user!._id.toString(), req.params.id);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============ Teacher Data Fetching Controllers ============

export const getTeacherCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await courseService.getTeacherCourses(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: courses,
  });
});

export const getTeacherTopics = asyncHandler(async (req: Request, res: Response) => {
  const topics = await courseService.getTeacherTopics(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: topics,
  });
});

export const getTeacherQuestions = asyncHandler(async (req: Request, res: Response) => {
  const questions = await courseService.getTeacherQuestions(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: questions,
  });
});
