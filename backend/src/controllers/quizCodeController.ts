import { Request, Response } from 'express';
import { quizCodeService } from '../services/quizCodeService';
import { asyncHandler } from '../middleware/errorHandler';

// Generate a new quiz code
export const generateQuizCode = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.params;
  const { maxAttempts, expiresAt, courseId } = req.body;
  const userId = (req as any).user?.id;

  if (!quizId || !courseId) {
    res.status(400).json({
      success: false,
      error: { message: 'quizId and courseId are required' }
    });
    return;
  }

  try {
    const code = await quizCodeService.generateCode(
      quizId,
      courseId,
      userId,
      maxAttempts,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.status(201).json({
      success: true,
      data: {
        code: code.code,
        quizId: code.quiz_id,
        createdAt: code.created_at,
        expiresAt: code.expires_at
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Access quiz by code (student)
export const accessQuizByCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const userId = req.user!._id.toString();
  const userRole = req.user!.role;

  if (!code) {
    res.status(400).json({
      success: false,
      error: { message: 'Code is required' }
    });
    return;
  }

  try {
    const result = await quizCodeService.accessByCode(code, userId, userRole);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Get all codes for a quiz (teacher)
export const getQuizCodes = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const codes = await quizCodeService.getCodesForQuiz(quizId, userId);

    res.status(200).json({
      success: true,
      data: codes.map(c => ({
        code: c.code,
        createdAt: c.created_at,
        accessCount: c.access_count,
        isActive: c.is_active,
        maxAttempts: c.max_attempts,
        expiresAt: c.expires_at
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Toggle code status
export const toggleQuizCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const { isActive } = req.body;
  const userId = (req as any).user?.id;

  try {
    const updated = await quizCodeService.toggleCode(code, userId, isActive);

    res.status(200).json({
      success: true,
      data: {
        code: updated.code,
        isActive: updated.is_active
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Delete a code
export const deleteQuizCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const userId = (req as any).user?.id;

  try {
    await quizCodeService.deleteCode(code, userId);

    res.status(200).json({
      success: true,
      message: 'Code deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});
