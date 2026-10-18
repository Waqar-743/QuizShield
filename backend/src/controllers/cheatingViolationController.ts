import { Request, Response } from 'express';
import { cheatingViolationService, ViolationType } from '../services/cheatingViolationService';
import { asyncHandler } from '../middleware/errorHandler';
import { supabase } from '../config/supabase';

// Report a violation — student must own the attempt
export const reportViolation = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const {
    violationType,
    violation_type,
    event_timestamp,
    alert_message,
    duration_seconds,
    meta_data,
  } = req.body;
  const userId = req.user?._id || (req as any).user?.id;

  const normalizedViolationType = violation_type || violationType;

  if (!attemptId || !normalizedViolationType) {
    res.status(400).json({
      success: false,
      error: { message: 'attemptId and violationType are required' },
    });
    return;
  }

  // Verify the attempt belongs to the requesting student
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('user_id,quiz_id,status')
    .eq('id', attemptId)
    .single();

  if (!attempt || attempt.user_id !== userId) {
    res.status(403).json({
      success: false,
      error: { message: 'Not authorized to report violations for this attempt' },
    });
    return;
  }
  if(attempt.status!=='in-progress') throw Object.assign(new Error('This attempt is no longer accepting events'),{statusCode:409});
  const allowedTypes=['tab_change','focus_loss','copy_attempt','right_click','screenshot_attempt','keyboard_shortcut','TAB_SWITCH','SYSTEM_FOCUS_LOST','RESTRICTED_KEY'];
  if(!allowedTypes.includes(normalizedViolationType)) throw Object.assign(new Error('Invalid violation type'),{statusCode:400});
  const {data:quiz}=await supabase.from('teacher_quizzes').select('teacher_id').eq('id',attempt.quiz_id).single();
  if(!quiz) throw Object.assign(new Error('Assessment not found'),{statusCode:404});

  try {
    const result = await cheatingViolationService.reportViolation({
      quizAttemptId: attemptId,
      studentId: userId,
      quizId: attempt.quiz_id,
      teacherId: quiz.teacher_id,
      violationType: normalizedViolationType as ViolationType,
      detectionMethod: 'browser_event',
      details: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        eventTimestamp: event_timestamp,
        alertMessage: alert_message,
        durationSeconds: duration_seconds,
        payloadMetaData: meta_data,
      },
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    throw error;
  }
});

// Get violations for an attempt
export const getViolations = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user?._id || (req as any).user?.id;
  const userRole = req.user?.role || (req as any).user?.role || 'student';

  try {
    const result = await cheatingViolationService.getViolationsForAttempt(
      attemptId,
      userId,
      userRole,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    throw error;
  }
});

// Get violation summary for teacher
export const getViolationSummary = asyncHandler(async (req: Request, res: Response) => {
  const { quizId } = req.query;
  const userId = req.user?._id || (req as any).user?.id;

  try {
    const result = await cheatingViolationService.getViolationSummary(
      userId,
      quizId as string | undefined,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    throw error;
  }
});

// Flag an attempt — teachers only
export const flagAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user?._id || (req as any).user?.id;
  const userRole = req.user?.role;

  if (userRole !== 'teacher' && userRole !== 'admin') {
    res.status(403).json({ success: false, error: { message: 'Only teachers can flag attempts' } });
    return;
  }

  try {
    const result = await cheatingViolationService.flagAttempt(attemptId, userId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    throw error;
  }
});

// Invalidate an attempt — teachers only
export const invalidateAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user?._id || (req as any).user?.id;
  const userRole = req.user?.role;

  if (userRole !== 'teacher' && userRole !== 'admin') {
    res.status(403).json({ success: false, error: { message: 'Only teachers can invalidate attempts' } });
    return;
  }

  try {
    const result = await cheatingViolationService.invalidateAttempt(attemptId, userId);
    res.status(200).json({ success: true, data: result, message: 'Attempt has been invalidated' });
  } catch (error: any) {
    throw error;
  }
});
