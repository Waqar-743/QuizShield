import { Request, Response } from 'express';
import { cheatingViolationService, ViolationType } from '../services/cheatingViolationService';
import { asyncHandler } from '../middleware/errorHandler';

// Report a violation
export const reportViolation = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const {
    violationType,
    violation_type,
    detectionMethod,
    event_timestamp,
    alert_message,
    duration_seconds,
    meta_data,
    quizId,
    teacherId,
  } = req.body;
  const userId = (req as any).user?.id;

  const normalizedViolationType = violation_type || violationType;

  if (!attemptId || !normalizedViolationType) {
    res.status(400).json({
      success: false,
      error: { message: 'attemptId and violationType are required' }
    });
    return;
  }

  try {
    const result = await cheatingViolationService.reportViolation({
      quizAttemptId: attemptId,
      studentId: userId,
      quizId: quizId || '',
      teacherId,
      violationType: normalizedViolationType as ViolationType,
      detectionMethod: detectionMethod || 'browser_event',
      details: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        eventTimestamp: event_timestamp,
        alertMessage: alert_message,
        durationSeconds: duration_seconds,
        payloadMetaData: meta_data,
      }
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Get violations for an attempt
export const getViolations = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role || 'student';

  try {
    const result = await cheatingViolationService.getViolationsForAttempt(
      attemptId,
      userId,
      userRole
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(error.message.includes('authorized') ? 403 : 500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Get violation summary for teacher
export const getViolationSummary = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.query;
  const userId = (req as any).user?.id;

  try {
    const result = await cheatingViolationService.getViolationSummary(
      userId,
      quizId as string | undefined
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Flag an attempt
export const flagAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const result = await cheatingViolationService.flagAttempt(attemptId, userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// Invalidate an attempt
export const invalidateAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const result = await cheatingViolationService.invalidateAttempt(attemptId, userId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Attempt has been invalidated'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});
