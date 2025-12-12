import { supabase } from '../config/supabase';

export type ViolationType = 'tab_change' | 'copy_attempt' | 'right_click' | 'screenshot_attempt' | 'keyboard_shortcut';
export type Severity = 'low' | 'medium' | 'high';

interface ViolationInput {
  quizAttemptId: string;
  studentId: string;
  quizId: string;
  teacherId?: string;
  violationType: ViolationType;
  detectionMethod: string;
  severity?: Severity;
  details?: {
    windowFocused?: boolean;
    userAgent?: string;
    ipAddress?: string;
  };
}

export const cheatingViolationService = {
  // Report a new violation
  async reportViolation(input: ViolationInput) {
    const { data: violation, error } = await supabase
      .from('cheating_violations')
      .insert([{
        quiz_attempt_id: input.quizAttemptId,
        student_id: input.studentId,
        quiz_id: input.quizId,
        teacher_id: input.teacherId || null,
        violation_type: input.violationType,
        detection_method: input.detectionMethod,
        severity: input.severity || 'low',
        details: input.details || {},
        timestamp: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Get updated violation count
    const { count } = await supabase
      .from('cheating_violations')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_attempt_id', input.quizAttemptId);

    // Update the quiz_attempts table with violation count
    await supabase
      .from('quiz_attempts')
      .update({ violation_count: count || 1 })
      .eq('id', input.quizAttemptId);

    return {
      violationId: violation.id,
      violationCount: count || 1
    };
  },

  // Get violations for an attempt
  async getViolationsForAttempt(attemptId: string, requesterId: string, requesterRole: string) {
    // First get the attempt to verify access
    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .select('user_id, topic_id')
      .eq('id', attemptId)
      .single();

    if (!attempt) {
      throw new Error('Quiz attempt not found');
    }

    // Check authorization - student can view their own, teacher can view their students'
    // For now, allow if requester is the student or a teacher
    if (requesterRole === 'student' && attempt.user_id !== requesterId) {
      throw new Error('You are not authorized to view these violations');
    }

    // Get violations
    const { data: violations, error } = await supabase
      .from('cheating_violations')
      .select('*')
      .eq('quiz_attempt_id', attemptId)
      .order('timestamp', { ascending: true });

    if (error) throw new Error(error.message);

    // Get student name
    const { data: student } = await supabase
      .from('users')
      .select('name')
      .eq('id', attempt.user_id)
      .single();

    // Get quiz name
    const { data: topic } = await supabase
      .from('topics')
      .select('title')
      .eq('id', attempt.topic_id)
      .single();

    return {
      attemptId,
      studentName: student?.name || 'Unknown',
      quizName: topic?.title || 'Unknown Quiz',
      totalViolations: violations?.length || 0,
      violations: violations?.map(v => ({
        id: v.id,
        type: v.violation_type,
        timestamp: v.timestamp,
        severity: v.severity,
        detectionMethod: v.detection_method
      })) || []
    };
  },

  // Get violation summary for teacher dashboard
  async getViolationSummary(teacherId: string, quizId?: string) {
    let query = supabase
      .from('cheating_violations')
      .select(`
        *,
        quiz_attempts:quiz_attempt_id (
          user_id,
          topic_id,
          score,
          max_score
        )
      `)
      .eq('teacher_id', teacherId);

    if (quizId) {
      query = query.eq('quiz_id', quizId);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error) throw new Error(error.message);

    // Group by attempt and calculate stats
    const attemptViolations: Record<string, any> = {};
    (data || []).forEach((v: any) => {
      if (!attemptViolations[v.quiz_attempt_id]) {
        attemptViolations[v.quiz_attempt_id] = {
          attemptId: v.quiz_attempt_id,
          violations: [],
          totalCount: 0
        };
      }
      attemptViolations[v.quiz_attempt_id].violations.push(v);
      attemptViolations[v.quiz_attempt_id].totalCount++;
    });

    return {
      totalViolations: data?.length || 0,
      suspiciousAttempts: Object.keys(attemptViolations).length,
      byType: {
        tab_change: data?.filter(v => v.violation_type === 'tab_change').length || 0,
        copy_attempt: data?.filter(v => v.violation_type === 'copy_attempt').length || 0,
        screenshot_attempt: data?.filter(v => v.violation_type === 'screenshot_attempt').length || 0,
        keyboard_shortcut: data?.filter(v => v.violation_type === 'keyboard_shortcut').length || 0,
        right_click: data?.filter(v => v.violation_type === 'right_click').length || 0
      },
      attempts: Object.values(attemptViolations)
    };
  },

  // Flag an attempt as suspicious
  async flagAttempt(attemptId: string, teacherId: string) {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .update({ is_flagged: true })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Invalidate an attempt
  async invalidateAttempt(attemptId: string, teacherId: string) {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .update({ 
        status: 'invalidated',
        is_flagged: true
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};
