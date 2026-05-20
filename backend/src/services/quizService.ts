import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { aiService } from './aiService';

interface QuizQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
  explanation?: string;
  timeLimit?: number;
  questionType?: 'multipleChoice' | 'shortAnswer';
  answerText?: string;
}

interface QuizData {
  title: string;
  description?: string;
  timeLimit?: number;
  scheduledStart?: string;
  courseId?: string;
  questions: QuizQuestion[];
  cameraMonitoring?: boolean;
}

const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_QUESTIONS = 200;
const MAX_QUESTION_TEXT_LEN = 2000;
const MAX_OPTION_LEN = 500;
const MAX_OPTIONS = 10;

function validateQuizPayload(data: QuizData) {
  const err = (m: string) => Object.assign(new Error(m), { statusCode: 400 });
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw err('Quiz title is required');
  }
  if (data.title.length > MAX_TITLE_LEN) throw err(`Title must be at most ${MAX_TITLE_LEN} characters`);
  if (data.description && data.description.length > MAX_DESCRIPTION_LEN) {
    throw err(`Description must be at most ${MAX_DESCRIPTION_LEN} characters`);
  }
  if (data.timeLimit !== undefined && data.timeLimit !== null) {
    if (typeof data.timeLimit !== 'number' || data.timeLimit < 1 || data.timeLimit > 600) {
      throw err('Time limit must be between 1 and 600 minutes');
    }
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw err('Quiz must contain at least one question');
  }
  if (data.questions.length > MAX_QUESTIONS) {
    throw err(`Quiz cannot have more than ${MAX_QUESTIONS} questions`);
  }
  data.questions.forEach((q, i) => {
    if (!q.text || typeof q.text !== 'string' || q.text.trim().length === 0) {
      throw err(`Question ${i + 1}: text is required`);
    }
    if (q.text.length > MAX_QUESTION_TEXT_LEN) {
      throw err(`Question ${i + 1}: text exceeds ${MAX_QUESTION_TEXT_LEN} characters`);
    }
    const isShortAnswer = q.questionType === 'shortAnswer';
    if (!isShortAnswer) {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw err(`Question ${i + 1}: must have at least 2 options`);
      }
      if (q.options.length > MAX_OPTIONS) {
        throw err(`Question ${i + 1}: at most ${MAX_OPTIONS} options allowed`);
      }
      if (q.options.some((o) => typeof o !== 'string' || o.length > MAX_OPTION_LEN)) {
        throw err(`Question ${i + 1}: option exceeds ${MAX_OPTION_LEN} characters`);
      }
      if (
        typeof q.correctAnswer !== 'number' ||
        q.correctAnswer < 0 ||
        q.correctAnswer >= q.options.length
      ) {
        throw err(`Question ${i + 1}: correctAnswer index is out of range`);
      }
    } else {
      if (!q.answerText || typeof q.answerText !== 'string' || q.answerText.trim().length === 0) {
        throw err(`Question ${i + 1}: answerText is required for short answer`);
      }
    }
  });
}

export const quizService = {
  // Generate a unique 4-digit access code. Cryptographically random to avoid
  // predictability; uses maybeSingle() so a no-row response is not treated as
  // an error. The 9000-key space is small — pair with a UNIQUE constraint on
  // teacher_quizzes.access_code so a race between two creators surfaces as a
  // DB error instead of silently overwriting.
  async generateUniqueCode(): Promise<string> {
    const randomCode = () => {
      const n = crypto.randomInt(1000, 10000);
      return n.toString();
    };
    const maxAttempts = 25;

    for (let i = 0; i < maxAttempts; i++) {
      const code = randomCode();
      const { data: existing } = await supabase
        .from('teacher_quizzes')
        .select('id')
        .eq('access_code', code)
        .maybeSingle();
      if (!existing) return code;
    }

    throw new Error('Failed to generate unique code. Please try again.');
  },

  // Send notification only to students enrolled in the quiz course
  async notifyCourseStudents(quizTitle: string, quizId: string, accessCode: string, teacherId: string, courseId: string, scheduledStart?: string) {
    // Get teacher name
    const { data: teacher } = await supabase
      .from('users')
      .select('name')
      .eq('id', teacherId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();

    const teacherName = teacher?.name || 'Your teacher';

    // Format scheduled time message
    let timeMessage = '';
    if (scheduledStart) {
      const startDate = new Date(scheduledStart);
      timeMessage = ` Starts at: ${startDate.toLocaleString()}.`;
    }

    // Get only students enrolled in this course
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('course_id', courseId);

    const studentIds = [...new Set((enrollments || []).map((e: any) => e.user_id))];

    if (studentIds.length > 0) {
      const notifications = studentIds.map((studentId: string) => ({
        user_id: studentId,
        title: 'New Quiz Available!',
        message: `${teacherName} has created a new quiz for ${course?.title || 'your course'}: "${quizTitle}". Code: ${accessCode}.${timeMessage}`,
        type: 'quiz',
        quiz_id: quizId,
        quiz_code: accessCode,
        is_read: false,
      }));

      await supabase.from('notifications').insert(notifications);
    }
  },

  // Teacher quiz management
  async createQuiz(teacherId: string, data: QuizData) {
    if (!data.courseId) {
      throw new Error('Course is required to create a quiz');
    }
    validateQuizPayload(data);

    const { data: courseOwner } = await supabase
      .from('courses')
      .select('id, created_by')
      .eq('id', data.courseId)
      .single();

    if (!courseOwner || courseOwner.created_by !== teacherId) {
      throw new Error('You can only create quizzes for your own courses');
    }

    // Generate unique 4-digit access code
    const accessCode = await this.generateUniqueCode();

    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .insert([{
        teacher_id: teacherId,
        title: data.title,
        description: data.description || '',
        course_id: data.courseId,
        time_limit: data.timeLimit,
        questions: data.questions,
        access_code: accessCode,
        scheduled_start: data.scheduledStart || null,
        is_active: true,
        camera_monitoring: data.cameraMonitoring !== false,
        created_at: new Date(),
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Send notification only to enrolled students in selected course
    await this.notifyCourseStudents(data.title, quiz.id, accessCode, teacherId, data.courseId, data.scheduledStart);

    const { data: course } = await supabase
      .from('courses')
      .select('title')
      .eq('id', data.courseId)
      .single();

    return {
      _id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      courseId: quiz.course_id,
      courseTitle: course?.title || 'Unknown Course',
      timeLimit: quiz.time_limit,
      questions: quiz.questions,
      accessCode: quiz.access_code,
      scheduledStart: quiz.scheduled_start,
      cameraMonitoring: quiz.camera_monitoring !== false,
      createdAt: quiz.created_at,
    };
  },

  async getTeacherQuizzes(teacherId: string) {
    const { data: quizzes, error } = await supabase
      .from('teacher_quizzes')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const courseIds = [...new Set((quizzes || []).map((q: any) => q.course_id).filter(Boolean))];
    let courseMap = new Map<string, string>();

    if (courseIds.length > 0) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds);

      courseMap = new Map((courses || []).map((c: any) => [c.id, c.title]));
    }
    
    return (quizzes || []).map((q: any) => ({
      _id: q.id,
      title: q.title,
      description: q.description,
      courseId: q.course_id,
      courseTitle: q.course_id ? (courseMap.get(q.course_id) || 'Unknown Course') : 'General',
      timeLimit: q.time_limit,
      questions: q.questions || [],
      accessCode: q.access_code,
      scheduledStart: q.scheduled_start,
      cameraMonitoring: q.camera_monitoring !== false,
      createdAt: q.created_at,
    }));
  },

  async updateQuiz(quizId: string, teacherId: string, data: QuizData) {
    validateQuizPayload(data);
    const updatePayload: any = {
      title: data.title,
      description: data.description || '',
      time_limit: data.timeLimit,
      questions: data.questions,
      updated_at: new Date(),
    };
    if (typeof data.cameraMonitoring === 'boolean') {
      updatePayload.camera_monitoring = data.cameraMonitoring;
    }
    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .update(updatePayload)
      .eq('id', quizId)
      .eq('teacher_id', teacherId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      _id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.time_limit,
      questions: quiz.questions,
      createdAt: quiz.created_at,
    };
  },

  async deleteQuiz(quizId: string, teacherId: string) {
    const { error } = await supabase
      .from('teacher_quizzes')
      .delete()
      .eq('id', quizId)
      .eq('teacher_id', teacherId);

    if (error) throw new Error(error.message);
    return { success: true };
  },

  // Start a teacher quiz by access code
  async startQuizByCode(code: string, userId: string) {
    // Get quiz by code
    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .select('*')
      .eq('access_code', code)
      .single();

    if (error || !quiz) {
      throw new Error('Invalid quiz code');
    }

    // Ensure student is enrolled if this quiz is course-specific
    if (quiz.course_id) {
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

    // Check if quiz has a scheduled start time. The teacher-defined `time_limit`
    // is the per-attempt duration, NOT the availability window. The availability
    // window is controlled separately by `is_active`. We only block early starts.
    if (quiz.scheduled_start) {
      const scheduledTime = new Date(quiz.scheduled_start);
      const now = new Date();
      if (now < scheduledTime) {
        throw new Error(`Quiz will start at ${scheduledTime.toLocaleString()}. Please wait.`);
      }
    }

    if (quiz.is_active === false) {
      throw new Error('This quiz is no longer accepting attempts.');
    }

    // Reuse an existing in-progress attempt instead of spawning duplicates.
    // This also prevents a student from racing two concurrent attempts to
    // submit different answer sets.
    const { data: existing } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_id', quiz.id)
      .eq('status', 'in-progress')
      .order('started_at', { ascending: false })
      .limit(1);

    let attempt = existing && existing.length > 0 ? existing[0] : null;

    if (!attempt) {
      const { data: created, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert([{
          user_id: userId,
          quiz_id: quiz.id,
          started_at: new Date(),
          status: 'in-progress',
          max_score: quiz.questions?.length || 0,
        }])
        .select()
        .single();

      if (attemptError) throw new Error(attemptError.message);
      attempt = created;
    }

    return {
      attemptId: attempt.id,
      quiz: {
        _id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        courseId: quiz.course_id,
        timeLimit: quiz.time_limit,
        cameraMonitoring: quiz.camera_monitoring !== false,
        questions: quiz.questions?.map((q: any, index: number) => ({
          _id: `${quiz.id}-q${index}`,
          text: q.text,
          options: q.options,
          difficulty: q.difficulty,
        })) || [],
      }
    };
  },

  // Get attempt results for student
  async getAttemptResults(attemptId: string, userId: string, userRole: string) {
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (error || !attempt) {
      throw new Error('Attempt not found');
    }

    // Get quiz details
    const { data: quiz } = await supabase
      .from('teacher_quizzes')
      .select('*')
      .eq('id', attempt.quiz_id)
      .single();

    const isStudentOwner = attempt.user_id === userId;
    const isTeacherOwner = !!quiz && quiz.teacher_id === userId;

    if (!isStudentOwner && !(userRole === 'teacher' && isTeacherOwner) && userRole !== 'admin') {
      throw new Error('Unauthorized to view this attempt');
    }

    const isReviewed = attempt.teacher_grade !== null && attempt.teacher_grade !== undefined;

    // Students never see violation details — only teachers/admins.
    const showViolations = !isStudentOwner;

    if (isStudentOwner && !isReviewed) {
      return {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at,
        reviewPending: true,
        reviewStatus: 'pending',
        autoSubmitted: attempt.auto_submitted,
        quiz: quiz ? {
          title: quiz.title,
          description: quiz.description,
          cameraMonitoring: quiz.camera_monitoring !== false,
          questions: [],
        } : null,
      };
    }

    return {
      id: attempt.id,
      score: attempt.score,
      maxScore: attempt.max_score,
      percentage: attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0,
      status: attempt.status,
      startedAt: attempt.started_at,
      completedAt: attempt.completed_at,
      answers: attempt.answers || [],
      ...(showViolations
        ? {
            violations: attempt.violations || [],
            submissionReason: attempt.submission_reason,
          }
        : {}),
      teacherGrade: attempt.teacher_grade,
      teacherFeedback: attempt.teacher_feedback,
      reviewPending: false,
      reviewStatus: 'reviewed',
      autoSubmitted: attempt.auto_submitted,
      quiz: quiz ? {
        title: quiz.title,
        description: quiz.description,
        cameraMonitoring: quiz.camera_monitoring !== false,
        questions: quiz.questions || [],
      } : null,
    };
  },

  // Get all submissions for teacher
  async getTeacherSubmissions(teacherId: string) {
    // Get all quizzes by this teacher
    const { data: quizzes } = await supabase
      .from('teacher_quizzes')
      .select('id, title')
      .eq('teacher_id', teacherId);

    if (!quizzes || quizzes.length === 0) return [];

    const quizIds = quizzes.map(q => q.id);
    const quizMap = new Map(quizzes.map(q => [q.id, q.title]));

    // Get all attempts for these quizzes
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .in('quiz_id', quizIds)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (!attempts) return [];

    // Get student info for each attempt
    const userIds = [...new Set(attempts.map(a => a.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    return attempts.map(attempt => {
      const user = userMap.get(attempt.user_id) || { name: 'Unknown', email: '' };
      // Normalize violations to always have a `type` field
      const rawViolations = attempt.violations || [];
      const normalizedViolations = Array.isArray(rawViolations) 
        ? rawViolations.map((v: any) => ({
            type: v?.type || v?.violation_type || 'unknown',
            timestamp: v?.timestamp || v?.created_at || new Date().toISOString(),
            details: v?.details || undefined,
          }))
        : [];
      return {
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: quizMap.get(attempt.quiz_id) || 'Unknown Quiz',
        studentId: attempt.user_id,
        studentName: user.name || 'Unknown',
        studentEmail: user.email || '',
        score: attempt.score,
        maxScore: attempt.max_score,
        percentage: attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0,
        status: attempt.status,
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at,
        teacherGrade: attempt.teacher_grade,
        teacherFeedback: attempt.teacher_feedback,
        answers: attempt.answers || [],
        violations: normalizedViolations,
        autoSubmitted: attempt.auto_submitted,
        submissionReason: attempt.submission_reason,
      };
    });
  },

  // Get quiz details for teacher
  async getTeacherQuizDetails(quizId: string, teacherId: string) {
    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('teacher_id', teacherId)
      .single();

    if (error || !quiz) {
      throw new Error('Quiz not found');
    }

    return {
      id: quiz.id,
      title: quiz.title,
      questions: quiz.questions || [],
    };
  },

  // Grade a submission
  async gradeSubmission(submissionId: string, teacherId: string, grade: number, feedback: string) {
    // Verify the submission belongs to a quiz by this teacher
    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, user_id')
      .eq('id', submissionId)
      .single();

    if (!attempt) {
      throw new Error('Submission not found');
    }

    const { data: quiz } = await supabase
      .from('teacher_quizzes')
      .select('teacher_id, title')
      .eq('id', attempt.quiz_id)
      .single();

    if (!quiz || quiz.teacher_id !== teacherId) {
      throw new Error('Unauthorized');
    }

    // Update the attempt with grade and feedback
    const { error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        teacher_grade: grade,
        teacher_feedback: feedback,
      })
      .eq('id', submissionId);

    if (updateError) throw new Error(updateError.message);

    // Send notification to student
    await supabase.from('notifications').insert([{
      user_id: attempt.user_id,
      title: 'Quiz Graded!',
      message: `Your quiz "${quiz.title}" has been graded. Grade: ${grade}%`,
      type: 'grade',
      quiz_id: attempt.quiz_id,
      is_read: false,
    }]);

    return { success: true };
  },

  // Submit all quiz answers at once
  async submitAllAnswers(
    attemptId: string, 
    userId: string, 
    answers: { questionId: string; selectedAnswer: number | string }[],
    violations?: { type: string; timestamp: string; details?: string }[]
  ) {
    // Get the attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .single();

    if (attemptError || !attempt) {
      throw new Error('Quiz attempt not found');
    }

    if (attempt.status === 'completed') {
      throw new Error('Quiz already submitted');
    }

    // Get quiz to calculate score
    const { data: quiz, error: quizError } = await supabase
      .from('teacher_quizzes')
      .select('id, title, teacher_id, questions')
      .eq('id', attempt.quiz_id)
      .single();

    if (quizError || !quiz) {
      throw new Error('Quiz not found');
    }

    // Calculate score
    let score = 0;
    const questions = quiz.questions || [];

    // Robustly extract the trailing question index from a "<quizId>-q<N>" id.
    // The previous `split('-q')[1]` was fragile because quiz UUIDs can contain
    // a literal "-q" segment.
    const extractQuestionIndex = (qid: string): number => {
      if (typeof qid !== 'string') return NaN;
      const m = qid.match(/-q(\d+)$/);
      return m ? parseInt(m[1], 10) : NaN;
    };

    answers.forEach((answer) => {
      const questionIndex = extractQuestionIndex(answer.questionId);
      if (Number.isNaN(questionIndex)) return;
      const question = questions[questionIndex];
      if (!question) return;

      const isShortAnswer = question.questionType === 'shortAnswer' || !question.options || question.options.length === 0;
      if (isShortAnswer) {
        const submitted = String(answer.selectedAnswer ?? '').trim().toLowerCase();
        const expected = String(question.answerText ?? '').trim().toLowerCase();
        if (submitted && expected && submitted === expected) {
          score++;
        }
      } else if (answer.selectedAnswer === question.correctAnswer) {
        score++;
      }
    });

    // Update the attempt with violations
    const updateData: any = {
      status: 'completed',
      completed_at: new Date(),
      score,
      answers,
    };
    
    if (violations && violations.length > 0) {
      updateData.violations = violations;
      updateData.violation_count = violations.length;
    }

    // Atomic guard: only the first concurrent submit succeeds. The
    // `.eq('status', 'in-progress')` filter prevents a double-submit from
    // overwriting the original score with a second answer set.
    const { data: updatedRows, error: updateError } = await supabase
      .from('quiz_attempts')
      .update(updateData)
      .eq('id', attemptId)
      .eq('status', 'in-progress')
      .select('id');

    if (updateError) throw new Error(updateError.message);
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error('Quiz already submitted');
    }

    if (quiz.teacher_id) {
      const { error: notifyError } = await supabase.from('notifications').insert([{
        user_id: quiz.teacher_id,
        title: 'Submission Pending Review',
        message: 'A student submitted quiz "' + quiz.title + '" and is waiting for your review.',
        type: 'submission',
        quiz_id: quiz.id,
        is_read: false,
      }]);

      if (notifyError) {
        console.error('Failed to notify teacher about submission:', notifyError.message);
      }
    }

    return {
      score,
      maxScore: questions.length,
      percentage: questions.length > 0 ? Math.round((score / questions.length) * 100) : 0,
      violationsCount: violations?.length || 0,
    };
  },

  async getQuizForTopic(topicId: string, userId: string, difficulty?: string) {
    // 1. Determine difficulty (simplified logic)
    let targetDifficulty = difficulty || 'Medium';

    // 2. Fetch questions from Supabase
    // Assuming we have a 'questions' table
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('topic_id', topicId)
      .eq('difficulty', targetDifficulty)
      .limit(5);

    if (error) throw new Error(error.message);

    // 3. If not enough questions, generate via AI (mocked or real)
    let finalQuestions = questions || [];
    if (finalQuestions.length < 5) {
       try {
         const generated = await aiService.generateQuestions(topicId, targetDifficulty, 5 - finalQuestions.length);
         // Save generated questions to DB
         if (generated && generated.length > 0) {
            const { data: savedQuestions } = await supabase
              .from('questions')
              .insert(generated.map((q: any) => ({ 
                content: q.content,
                options: q.options,
                correct_answer: q.correct_answer_index,
                explanation: q.explanation,
                topic_id: topicId, 
                difficulty: targetDifficulty 
              })))
              .select();
            
            if (savedQuestions) {
                finalQuestions = [...finalQuestions, ...savedQuestions];
            }
         }
       } catch (err) {
         console.error("AI Generation failed", err);
       }
    }

    // Create a quiz attempt record
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert([{ 
          user_id: userId, 
          topic_id: topicId, 
          difficulty: targetDifficulty,
          started_at: new Date(),
          status: 'in-progress',
          max_score: finalQuestions.length
      }])
      .select()
      .single();

    if (attemptError) throw new Error(attemptError.message);

    return {
      quizId: topicId, // Using topicId as quizId for simplicity in this context
      attemptId: attempt.id,
      questions: finalQuestions.map(q => ({ ...q, _id: q.id })), // Map id to _id
      difficulty: targetDifficulty
    };
  },

  async submitAnswer(attemptId: string, questionId: string, answer: string) {
    // Fetch question to check answer
    const { data: question } = await supabase
      .from('questions')
      .select('correct_answer')
      .eq('id', questionId)
      .single();

    if (!question) throw new Error('Question not found');

    const isCorrect = question.correct_answer === answer;

    // Record answer
    const { error } = await supabase
      .from('quiz_answers')
      .insert([{
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: answer,
        is_correct: isCorrect
      }]);

    if (error) throw new Error(error.message);

    return { isCorrect };
  },

  // Get teacher analytics
  async getTeacherAnalytics(teacherId: string) {
    // Get all quizzes by this teacher
    const { data: quizzes } = await supabase
      .from('teacher_quizzes')
      .select('id, title')
      .eq('teacher_id', teacherId);

    if (!quizzes || quizzes.length === 0) {
      return {
        totalStudents: 0,
        totalQuizzes: 0,
        totalAttempts: 0,
        avgScore: 0,
        passRate: 0,
        recentAttempts: [],
        scoreDistribution: [],
        weeklyData: [],
        courseParticipation: [],
      };
    }

    const quizIds = quizzes.map(q => q.id);

    // Get all attempts for these quizzes
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .in('quiz_id', quizIds)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    const completedAttempts = attempts || [];

    // Calculate stats
    const uniqueStudents = new Set(completedAttempts.map(a => a.user_id));
    const scores = completedAttempts.map(a => a.max_score > 0 ? (a.score / a.max_score) * 100 : 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const passCount = scores.filter(s => s >= 60).length;
    const passRate = scores.length > 0 ? (passCount / scores.length) * 100 : 0;

    // Score distribution
    const scoreDistribution = [
      { range: '0-50', count: scores.filter(s => s < 50).length, color: '#EF4444' },
      { range: '50-70', count: scores.filter(s => s >= 50 && s < 70).length, color: '#F59E0B' },
      { range: '70-85', count: scores.filter(s => s >= 70 && s < 85).length, color: '#10B981' },
      { range: '85-100', count: scores.filter(s => s >= 85).length, color: '#4ca1af' },
    ];

    // Weekly data for chart (last 4 weeks)
    const now = new Date();
    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      
      const weekAttempts = completedAttempts.filter(a => {
        const date = new Date(a.completed_at);
        return date >= weekStart && date < weekEnd;
      });

      weeklyData.push({
        date: `Week ${4 - i}`,
        attempts: weekAttempts.length,
        avgScore: weekAttempts.length > 0 
          ? Math.round(weekAttempts.reduce((sum, a) => sum + (a.max_score > 0 ? (a.score / a.max_score) * 100 : 0), 0) / weekAttempts.length)
          : 0,
      });
    }

    // Course-wise participation data (enrolled count, participating count, percentage)
    const { data: teacherCourses } = await supabase
      .from('courses')
      .select('id, title, created_by')
      .eq('created_by', teacherId);

    const courseParticipation: Array<{
      courseId: string;
      courseName: string;
      enrolledStudents: number;
      attemptedStudents: number;
      participationPercentage: number;
    }> = [];

    for (const course of teacherCourses || []) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('course_id', course.id);

      const enrolledIds = [...new Set((enrollments || []).map((e: any) => e.user_id))];

      const { data: courseQuizzes } = await supabase
        .from('teacher_quizzes')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('course_id', course.id);

      const courseQuizIds = (courseQuizzes || []).map((q: any) => q.id);

      let attemptedStudents = 0;
      if (courseQuizIds.length > 0) {
        const { data: courseAttempts } = await supabase
          .from('quiz_attempts')
          .select('user_id')
          .in('quiz_id', courseQuizIds)
          .eq('status', 'completed');

        attemptedStudents = new Set((courseAttempts || []).map((a: any) => a.user_id)).size;
      }

      const enrolledStudents = enrolledIds.length;
      const participationPercentage = enrolledStudents > 0
        ? Math.round((attemptedStudents / enrolledStudents) * 100)
        : 0;

      courseParticipation.push({
        courseId: course.id,
        courseName: course.title,
        enrolledStudents,
        attemptedStudents,
        participationPercentage,
      });
    }

    return {
      totalStudents: uniqueStudents.size,
      totalQuizzes: quizzes.length,
      totalAttempts: completedAttempts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      scoreDistribution,
      weeklyData,
      courseParticipation,
    };
  },

  // Get student analytics
  async getStudentAnalytics(userId: string) {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true });

    if (!attempts || attempts.length === 0) {
      return {
        totalQuizzes: 0,
        avgScore: 0,
        passRate: 0,
        streakDays: 0,
        performanceData: [],
      };
    }

    const scores = attempts.map(a => a.max_score > 0 ? (a.score / a.max_score) * 100 : 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passCount = scores.filter(s => s >= 60).length;
    const passRate = (passCount / scores.length) * 100;

    // Performance data for chart (last 6 attempts or weeks)
    const performanceData = attempts.slice(-6).map((a, index) => ({
      week: `Quiz ${index + 1}`,
      score: a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0,
    }));

    // Calculate streak (simplified - days with at least one quiz)
    let streakDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const hasAttempt = attempts.some(a => {
        const attemptDate = new Date(a.completed_at);
        attemptDate.setHours(0, 0, 0, 0);
        return attemptDate.getTime() === checkDate.getTime();
      });
      if (hasAttempt || i === 0) {
        if (hasAttempt) streakDays++;
      } else {
        break;
      }
    }

    return {
      totalQuizzes: attempts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      streakDays,
      performanceData,
    };
  },

  async getHint(questionId: string) {
      const { data: question } = await supabase
      .from('questions')
      .select('hint')
      .eq('id', questionId)
      .single();
      
      return question?.hint || "No hint available.";
  },

  async getQuizHistory(userId: string) {
    try {
      // Get user's quiz attempts
      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (error) throw new Error(error.message);
      if (!attempts || attempts.length === 0) return [];

      // Get quiz titles
      const quizIds = [...new Set(attempts.map(a => a.quiz_id))];
      const { data: quizzes } = await supabase
        .from('teacher_quizzes')
        .select('id, title')
        .in('id', quizIds);

      const quizMap = new Map(quizzes?.map(q => [q.id, q.title]) || []);

      return attempts.map(attempt => {
        const reviewed = attempt.teacher_grade !== null && attempt.teacher_grade !== undefined;
        return {
        _id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: quizMap.get(attempt.quiz_id) || 'Quiz',
        score: reviewed && attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : null,
        totalQuestions: attempt.max_score,
        correctAnswers: reviewed ? attempt.score : null,
        timeTaken: 0,
        isCompleted: attempt.status === 'completed',
        attemptedAt: attempt.completed_at || attempt.started_at,
        teacherGrade: reviewed ? attempt.teacher_grade : undefined,
        teacherFeedback: reviewed ? attempt.teacher_feedback : undefined,
        reviewStatus: reviewed ? 'reviewed' : 'pending',
      };
      });
    } catch (err) {
      console.error('Error fetching quiz history:', err);
      return [];
    }
  },

};
