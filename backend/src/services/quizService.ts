import { supabase } from '../config/supabase';
import { aiService } from './aiService';

interface QuizQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: string;
  explanation?: string;
}

interface QuizData {
  title: string;
  description?: string;
  timeLimit?: number;
  scheduledStart?: string;
  questions: QuizQuestion[];
}

export const quizService = {
  // Generate unique 4-digit code
  async generateUniqueCode(): Promise<string> {
    let code = Math.floor(1000 + Math.random() * 9000).toString();
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('teacher_quizzes')
        .select('id')
        .eq('access_code', code)
        .single();

      if (!existing) break;
      code = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique code. Please try again.');
    }
    return code;
  },

  // Send notification to all students
  async notifyAllStudents(quizTitle: string, quizId: string, accessCode: string, teacherId: string, scheduledStart?: string) {
    // Get teacher name
    const { data: teacher } = await supabase
      .from('users')
      .select('name')
      .eq('id', teacherId)
      .single();

    const teacherName = teacher?.name || 'Your teacher';

    // Format scheduled time message
    let timeMessage = '';
    if (scheduledStart) {
      const startDate = new Date(scheduledStart);
      timeMessage = ` Starts at: ${startDate.toLocaleString()}.`;
    }

    // Get all students
    const { data: students } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'student');

    if (students && students.length > 0) {
      const notifications = students.map((student: any) => ({
        user_id: student.id,
        title: 'New Quiz Available!',
        message: `${teacherName} has created a new quiz: "${quizTitle}". Code: ${accessCode}.${timeMessage}`,
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
    // Generate unique 4-digit access code
    const accessCode = await this.generateUniqueCode();

    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .insert([{
        teacher_id: teacherId,
        title: data.title,
        description: data.description || '',
        time_limit: data.timeLimit,
        questions: data.questions,
        access_code: accessCode,
        scheduled_start: data.scheduledStart || null,
        is_active: true,
        created_at: new Date(),
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Send notification to all students
    await this.notifyAllStudents(data.title, quiz.id, accessCode, teacherId, data.scheduledStart);

    return {
      _id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.time_limit,
      questions: quiz.questions,
      accessCode: quiz.access_code,
      scheduledStart: quiz.scheduled_start,
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
    
    return (quizzes || []).map((q: any) => ({
      _id: q.id,
      title: q.title,
      description: q.description,
      timeLimit: q.time_limit,
      questions: q.questions || [],
      accessCode: q.access_code,
      scheduledStart: q.scheduled_start,
      createdAt: q.created_at,
    }));
  },

  async updateQuiz(quizId: string, teacherId: string, data: QuizData) {
    const { data: quiz, error } = await supabase
      .from('teacher_quizzes')
      .update({
        title: data.title,
        description: data.description || '',
        time_limit: data.timeLimit,
        questions: data.questions,
        updated_at: new Date(),
      })
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

    // Check if quiz has a scheduled start time
    if (quiz.scheduled_start) {
      const scheduledTime = new Date(quiz.scheduled_start);
      const now = new Date();
      
      // Check if quiz hasn't started yet
      if (now < scheduledTime) {
        throw new Error(`Quiz will start at ${scheduledTime.toLocaleString()}. Please wait.`);
      }
      
      // Check if quiz has expired (scheduled_start + time_limit)
      const timeLimit = quiz.time_limit || 30; // default 30 minutes
      const expiryTime = new Date(scheduledTime.getTime() + timeLimit * 60 * 1000);
      if (now > expiryTime) {
        throw new Error('QUIZ_EXPIRED');
      }
    }

    // Create a quiz attempt
    const { data: attempt, error: attemptError } = await supabase
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

    return {
      attemptId: attempt.id,
      quiz: {
        _id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.time_limit,
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
  async getAttemptResults(attemptId: string, userId: string) {
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

    return {
      id: attempt.id,
      score: attempt.score,
      maxScore: attempt.max_score,
      percentage: attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0,
      status: attempt.status,
      startedAt: attempt.started_at,
      completedAt: attempt.completed_at,
      answers: attempt.answers || [],
      violations: attempt.violations || [],
      teacherGrade: attempt.teacher_grade,
      teacherFeedback: attempt.teacher_feedback,
      autoSubmitted: attempt.auto_submitted,
      submissionReason: attempt.submission_reason,
      quiz: quiz ? {
        title: quiz.title,
        description: quiz.description,
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
      return {
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: quizMap.get(attempt.quiz_id) || 'Unknown Quiz',
        studentId: attempt.user_id,
        studentName: user.name,
        studentEmail: user.email,
        score: attempt.score,
        maxScore: attempt.max_score,
        percentage: attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0,
        status: attempt.status,
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at,
        teacherGrade: attempt.teacher_grade,
        teacherFeedback: attempt.teacher_feedback,
        answers: attempt.answers || [],
        violations: attempt.violations || [],
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
    answers: { questionId: string; selectedAnswer: number }[],
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
      .select('questions')
      .eq('id', attempt.quiz_id)
      .single();

    if (quizError || !quiz) {
      throw new Error('Quiz not found');
    }

    // Calculate score
    let score = 0;
    const questions = quiz.questions || [];
    
    answers.forEach((answer) => {
      const questionIndex = parseInt(answer.questionId.split('-q')[1]);
      const question = questions[questionIndex];
      if (question && answer.selectedAnswer === question.correctAnswer) {
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

    const { error: updateError } = await supabase
      .from('quiz_attempts')
      .update(updateData)
      .eq('id', attemptId);

    if (updateError) throw new Error(updateError.message);

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

    if (!attempts || attempts.length === 0) {
      return {
        totalStudents: 0,
        totalQuizzes: quizzes.length,
        totalAttempts: 0,
        avgScore: 0,
        passRate: 0,
        recentAttempts: [],
        scoreDistribution: [],
        weeklyData: [],
      };
    }

    // Calculate stats
    const uniqueStudents = new Set(attempts.map(a => a.user_id));
    const scores = attempts.map(a => a.max_score > 0 ? (a.score / a.max_score) * 100 : 0);
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
      
      const weekAttempts = attempts.filter(a => {
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

    return {
      totalStudents: uniqueStudents.size,
      totalQuizzes: quizzes.length,
      totalAttempts: attempts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      scoreDistribution,
      weeklyData,
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

      return attempts.map(attempt => ({
        _id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: quizMap.get(attempt.quiz_id) || 'Quiz',
        score: attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0,
        totalQuestions: attempt.max_score,
        correctAnswers: attempt.score,
        timeTaken: 0,
        isCompleted: attempt.status === 'completed',
        attemptedAt: attempt.completed_at || attempt.started_at,
        teacherGrade: attempt.teacher_grade,
        teacherFeedback: attempt.teacher_feedback,
      }));
    } catch (err) {
      console.error('Error fetching quiz history:', err);
      return [];
    }
  },

  async getQuizHistoryOld(userId: string) {
    try {
      // Get user's quiz attempts with related data (old implementation)
      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select(`
          id,
          score,
          max_score,
          status,
          difficulty,
          started_at,
          completed_at,
          topic_id
        `)
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Get topic and course names for each attempt
      const attemptsWithDetails = await Promise.all(
        (attempts || []).map(async (attempt: any) => {
          let topicName = 'Unknown Topic';
          let courseName = 'Unknown Course';

          if (attempt.topic_id) {
            const { data: topic } = await supabase
              .from('topics')
              .select('title, course_id')
              .eq('id', attempt.topic_id)
              .single();

            if (topic) {
              topicName = topic.title;
              
              const { data: course } = await supabase
                .from('courses')
                .select('title')
                .eq('id', topic.course_id)
                .single();

              if (course) {
                courseName = course.title;
              }
            }
          }

          return {
            _id: attempt.id,
            topicName,
            courseName,
            score: attempt.score || 0,
            maxScore: attempt.max_score || 0,
            percentage: attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0,
            difficulty: attempt.difficulty || 'Medium',
            status: attempt.status,
            startedAt: attempt.started_at,
            completedAt: attempt.completed_at,
            date: attempt.completed_at || attempt.started_at,
          };
        })
      );

      return attemptsWithDetails;
    } catch (e) {
      console.error('Error fetching quiz history:', e);
      return [];
    }
  }
};
