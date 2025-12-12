import { Request, Response } from 'express';
import { questionService } from '../services/questionService';
import { asyncHandler } from '../middleware/errorHandler';

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { 
    topicId, questionText, questionType, options, 
    correctAnswer, correctAnswers, explanation, difficulty 
  } = req.body;
  const userId = (req as any).user?.id;

  if (!topicId || !questionText || !questionType || !difficulty) {
    res.status(400).json({
      success: false,
      error: { message: 'topicId, questionText, questionType, and difficulty are required' }
    });
    return;
  }

  try {
    const question = await questionService.createQuestion({
      topicId,
      questionText,
      questionType,
      options,
      correctAnswer,
      correctAnswers,
      explanation,
      difficulty,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      data: question
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

export const getQuestionsByTopic = asyncHandler(async (req: Request, res: Response) => {
  const { topicId } = req.params;

  try {
    const questions = await questionService.getQuestionsByTopic(topicId);

    res.status(200).json({
      success: true,
      data: questions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

export const getQuestionById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const question = await questionService.getQuestionById(id);

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    const question = await questionService.updateQuestion(id, req.body, userId);

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error: any) {
    res.status(error.message.includes('authorized') ? 403 : 500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    await questionService.deleteQuestion(id, userId);

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error: any) {
    res.status(error.message.includes('authorized') ? 403 : 500).json({
      success: false,
      error: { message: error.message }
    });
  }
});
