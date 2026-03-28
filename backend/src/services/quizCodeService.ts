import { supabase } from '../config/supabase';

// Generate a unique 4-digit numeric code
function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const quizCodeService = {
  // Generate a new quiz code
  async generateCode(quizId: string, courseId: string, teacherId: string, maxAttempts?: number, expiresAt?: Date) {
    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    const maxCodeAttempts = 10;

    // Ensure code is unique
    while (attempts < maxCodeAttempts) {
      const { data: existing } = await supabase
        .from('quiz_codes')
        .select('id')
        .eq('code', code)
        .single();

      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    if (attempts >= maxCodeAttempts) {
      throw new Error('Failed to generate unique code. Please try again.');
    }

    const { data, error } = await supabase
      .from('quiz_codes')
      .insert([{
        quiz_id: quizId,
        course_id: courseId || quizId,
        created_by: teacherId,
        code,
        expires_at: expiresAt || null,
        is_active: true,
        access_count: 0,
        max_attempts: maxAttempts || null
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Get quiz by code (for students) - now uses 4-digit code from teacher_quizzes
  async accessByCode(code: string, userId?: string, userRole?: string) {
    // First try to find quiz by access_code in teacher_quizzes
    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .select('*')
      .eq('access_code', code)
      .single();

    if (error || !quiz) {
      throw new Error('Invalid quiz code');
    }

    // If quiz is tied to a course, only enrolled students can access it
    if (quiz.course_id && userId && userRole === 'student') {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', quiz.course_id)
        .maybeSingle();

      if (!enrollment) {
        throw new Error('You are not enrolled in this course. Please join the course first.');
      }
    }

    let courseTitle = 'General';
    if (quiz.course_id) {
      const { data: course } = await supabase
        .from('courses')
        .select('title')
        .eq('id', quiz.course_id)
        .maybeSingle();
      courseTitle = course?.title || courseTitle;
    }

    // Calculate expiry time if scheduled
    let expiresAt = null;
    let isExpired = false;
    
    if (quiz.scheduled_start) {
      const scheduledTime = new Date(quiz.scheduled_start);
      const timeLimit = quiz.time_limit || 30;
      expiresAt = new Date(scheduledTime.getTime() + timeLimit * 60 * 1000).toISOString();
      isExpired = new Date() > new Date(expiresAt);
    }

    return {
      quiz: {
        _id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        courseId: quiz.course_id || null,
        courseTitle,
        timeLimit: quiz.time_limit,
        questionCount: quiz.questions?.length || 0,
        scheduledStart: quiz.scheduled_start,
        expiresAt,
        isExpired,
      },
      code: quiz.access_code
    };
  },

  // Get all codes for a quiz (teacher view)
  async getCodesForQuiz(quizId: string, teacherId: string) {
    const { data, error } = await supabase
      .from('quiz_codes')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Toggle code active status
  async toggleCode(code: string, teacherId: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('quiz_codes')
      .update({ is_active: isActive })
      .eq('code', code.toUpperCase())
      .eq('created_by', teacherId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Delete a code
  async deleteCode(code: string, teacherId: string) {
    const { error } = await supabase
      .from('quiz_codes')
      .delete()
      .eq('code', code.toUpperCase())
      .eq('created_by', teacherId);

    if (error) throw new Error(error.message);
    return { success: true };
  }
};
