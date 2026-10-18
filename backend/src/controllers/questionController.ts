import { Request, Response } from 'express';
import { questionService } from '../services/questionService';
import { asyncHandler } from '../middleware/errorHandler';

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { topicId, questionText, questionType, options, correctAnswer, correctAnswers, explanation, difficulty } = req.body;
  if (!topicId || !questionText || !questionType || !difficulty) {
    throw Object.assign(new Error('topicId, questionText, questionType, and difficulty are required'), {statusCode:400});
  }
  const question = await questionService.createQuestion({topicId,questionText,questionType,options,correctAnswer,correctAnswers,explanation,difficulty,createdBy:req.user!._id});
  res.status(201).json({success:true,data:question});
});
export const getQuestionsByTopic = asyncHandler(async (req: Request, res: Response) => {
  res.json({success:true,data:await questionService.getQuestionsByTopic(req.params.topicId,req.user!._id)});
});
export const getQuestionById = asyncHandler(async (req: Request, res: Response) => {
  res.json({success:true,data:await questionService.getQuestionById(req.params.id,req.user!._id)});
});
export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  res.json({success:true,data:await questionService.updateQuestion(req.params.id,req.body,req.user!._id)});
});
export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  await questionService.deleteQuestion(req.params.id,req.user!._id);
  res.json({success:true,message:'Question deleted successfully'});
});
