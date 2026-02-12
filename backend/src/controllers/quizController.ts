import { Request, Response } from 'express';
import { quizService } from '../services/quizService';
import { asyncHandler } from '../middleware/errorHandler';

// Teacher endpoints
export const createQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, timeLimit, scheduledStart, questions } = req.body;
  const teacherId = req.user!._id.toString();

  const quiz = await quizService.createQuiz(teacherId, {
    title,
    description,
    timeLimit,
    scheduledStart,
    questions,
  });

  res.status(201).json({
    success: true,
    data: quiz,
  });
});

export const getTeacherQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!._id.toString();
  const quizzes = await quizService.getTeacherQuizzes(teacherId);

  res.status(200).json({
    success: true,
    data: quizzes,
  });
});

export const updateQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.params;
  const { title, description, timeLimit, questions } = req.body;
  const teacherId = req.user!._id.toString();

  const quiz = await quizService.updateQuiz(quizId, teacherId, {
    title,
    description,
    timeLimit,
    questions,
  });

  res.status(200).json({
    success: true,
    data: quiz,
  });
});

export const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.params;
  const teacherId = req.user!._id.toString();

  await quizService.deleteQuiz(quizId, teacherId);

  res.status(200).json({
    success: true,
    message: 'Quiz deleted successfully',
  });
});

export const startQuizByCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const userId = req.user!._id.toString();

  const result = await quizService.startQuizByCode(code, userId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const submitAllAnswers = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const { answers, violations } = req.body;
  const userId = req.user!._id.toString();

  const result = await quizService.submitAllAnswers(attemptId, userId, answers, violations);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getAttemptResults = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user!._id.toString();
  const userRole = req.user!.role;

  const result = await quizService.getAttemptResults(attemptId, userId, userRole);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getTeacherSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!._id.toString();
  const submissions = await quizService.getTeacherSubmissions(teacherId);

  res.status(200).json({
    success: true,
    data: submissions,
  });
});

export const getTeacherQuizDetails = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.params;
  const teacherId = req.user!._id.toString();

  const quiz = await quizService.getTeacherQuizDetails(quizId, teacherId);

  res.status(200).json({
    success: true,
    data: quiz,
  });
});

export const gradeSubmission = asyncHandler(async (req: Request, res: Response) => {
  const { submissionId } = req.params;
  const { grade, feedback } = req.body;
  const teacherId = req.user!._id.toString();

  await quizService.gradeSubmission(submissionId, teacherId, grade, feedback);

  res.status(200).json({
    success: true,
    message: 'Grade saved successfully',
  });
});

export const getTeacherAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!._id.toString();
  const analytics = await quizService.getTeacherAnalytics(teacherId);

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

export const getStudentAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const analytics = await quizService.getStudentAnalytics(userId);

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

export const getQuizForTopic = asyncHandler(async (req: Request, res: Response) => {
  const { topicId } = req.params;
  const { difficulty } = req.query;
  
  const result = await quizService.getQuizForTopic(
    topicId,
    req.user!._id.toString(),
    difficulty as string
  );
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const submitAnswer = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId, questionId } = req.params;
  const { answer } = req.body;
  
  const result = await quizService.submitAnswer(
    attemptId,
    questionId,
    answer
  );
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getHint = asyncHandler(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const hint = await quizService.getHint(questionId);
  
  res.status(200).json({
    success: true,
    data: { hint },
  });
});

export const getQuizHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await quizService.getQuizHistory(req.user!._id.toString());
  
  res.status(200).json({
    success: true,
    data: history,
  });
});
