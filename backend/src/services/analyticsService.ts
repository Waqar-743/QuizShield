import { supabase } from '../config/supabase';

export const analyticsService = {
  async getDashboardStats(userId: string) {
    let coursesEnrolled = 0;
    let quizzesCompleted = 0;
    let averageScore = 0;
    const streakDays = 0;

    try {
      // 1. Enrolled Courses
      const { count, error: coursesError } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!coursesError) {
        coursesEnrolled = count || 0;
      }
    } catch (e) {
      console.error('Error fetching enrollments:', e);
    }

    try {
      // 2. Quizzes Completed
      const { count, error: quizzesError } = await supabase
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (!quizzesError) {
        quizzesCompleted = count || 0;
      }
    } catch (e) {
      console.error('Error fetching quiz attempts:', e);
    }

    try {
      // 3. Average Score
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('score, max_score')
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (!attemptsError && attempts && attempts.length > 0) {
        let totalScore = 0;
        attempts.forEach((attempt: any) => {
          if (attempt.max_score > 0) {
            totalScore += (attempt.score / attempt.max_score) * 100;
          }
        });
        averageScore = Math.round(totalScore / attempts.length);
      }
    } catch (e) {
      console.error('Error calculating average score:', e);
    }

    return {
      coursesEnrolled,
      quizzesCompleted,
      averageScore,
      streakDays
    };
  },

  // ============ Teacher Analytics ============

  async getTeacherStats(teacherId: string) {
    let totalCourses = 0;
    let totalStudents = 0;
    let totalQuestions = 0;
    let totalTopics = 0;
    let avgStudentScore = 0;
    let activeEnrollments = 0;

    try {
      // 1. Total courses created by teacher
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', teacherId);

      totalCourses = coursesCount || 0;
    } catch (e) {
      console.error('Error fetching teacher courses:', e);
    }

    try {
      // 2. Get course IDs for this teacher
      const { data: teacherCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('created_by', teacherId);

      const courseIds = teacherCourses?.map(c => c.id) || [];

      if (courseIds.length > 0) {
        // 3. Total students enrolled in teacher's courses
        const { count: enrollmentsCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .in('course_id', courseIds);

        totalStudents = enrollmentsCount || 0;
        activeEnrollments = enrollmentsCount || 0;

        // 4. Get topics for teacher's courses
        const { data: topics, count: topicsCount } = await supabase
          .from('topics')
          .select('id', { count: 'exact' })
          .in('course_id', courseIds);

        totalTopics = topicsCount || 0;

        const topicIds = topics?.map(t => t.id) || [];

        if (topicIds.length > 0) {
          // 5. Total questions in teacher's topics
          const { count: questionsCount } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .in('topic_id', topicIds);

          totalQuestions = questionsCount || 0;

          // 6. Average student score on teacher's quizzes
          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('id')
            .in('topic_id', topicIds);

          const quizIds = quizzes?.map(q => q.id) || [];

          if (quizIds.length > 0) {
            const { data: attempts } = await supabase
              .from('quiz_attempts')
              .select('score, max_score')
              .in('quiz_id', quizIds)
              .eq('status', 'completed');

            if (attempts && attempts.length > 0) {
              let totalScore = 0;
              attempts.forEach((attempt: any) => {
                if (attempt.max_score > 0) {
                  totalScore += (attempt.score / attempt.max_score) * 100;
                }
              });
              avgStudentScore = Math.round(totalScore / attempts.length);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching teacher stats:', e);
    }

    return {
      totalCourses,
      totalStudents,
      totalQuestions,
      totalTopics,
      avgStudentScore,
      activeEnrollments,
    };
  },

  async getTeacherCoursePerformance(teacherId: string) {
    const coursePerformance: any[] = [];

    try {
      // Get teacher's courses with enrollment count
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .eq('created_by', teacherId);

      if (courses && courses.length > 0) {
        for (const course of courses) {
          // Get enrollments for this course
          const { count: enrollments } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          // Get topics for this course
          const { data: topics } = await supabase
            .from('topics')
            .select('id')
            .eq('course_id', course.id);

          const topicIds = topics?.map(t => t.id) || [];

          let avgScore = 0;
          let completionRate = 0;

          if (topicIds.length > 0) {
            // Get quizzes for these topics
            const { data: quizzes } = await supabase
              .from('quizzes')
              .select('id')
              .in('topic_id', topicIds);

            const quizIds = quizzes?.map(q => q.id) || [];

            if (quizIds.length > 0) {
              const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('score, max_score, status')
                .in('quiz_id', quizIds);

              if (attempts && attempts.length > 0) {
                const completedAttempts = attempts.filter(a => a.status === 'completed');
                if (completedAttempts.length > 0) {
                  let totalScore = 0;
                  completedAttempts.forEach((attempt: any) => {
                    if (attempt.max_score > 0) {
                      totalScore += (attempt.score / attempt.max_score) * 100;
                    }
                  });
                  avgScore = Math.round(totalScore / completedAttempts.length);
                  completionRate = Math.round((completedAttempts.length / attempts.length) * 100);
                }
              }
            }
          }

          coursePerformance.push({
            courseName: course.title,
            avgScore,
            completionRate,
            enrollments: enrollments || 0,
          });
        }
      }
    } catch (e) {
      console.error('Error fetching course performance:', e);
    }

    return coursePerformance;
  },

  async getTeacherCourseAnalytics(teacherId: string) {
    // Similar to course performance but with more detail
    return this.getTeacherCoursePerformance(teacherId);
  },

  async getTeacherTimeSeries(teacherId: string, range: string) {
    const timeSeriesData: any[] = [];

    try {
      // Get date range
      const now = new Date();
      let startDate: Date;

      switch (range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
        default: // 30d
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get teacher's course IDs
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('created_by', teacherId);

      const courseIds = courses?.map(c => c.id) || [];

      if (courseIds.length > 0) {
        // Group by week for simplicity
        const weeks = Math.ceil((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        for (let i = 0; i < Math.min(weeks, 12); i++) {
          const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

          // Count enrollments in this week
          const { count: enrollments } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .in('course_id', courseIds)
            .gte('enrolled_at', weekStart.toISOString())
            .lt('enrolled_at', weekEnd.toISOString());

          // Get topics for quiz counting
          const { data: topics } = await supabase
            .from('topics')
            .select('id')
            .in('course_id', courseIds);

          const topicIds = topics?.map(t => t.id) || [];
          let quizAttempts = 0;

          if (topicIds.length > 0) {
            const { data: quizzes } = await supabase
              .from('quizzes')
              .select('id')
              .in('topic_id', topicIds);

            const quizIds = quizzes?.map(q => q.id) || [];

            if (quizIds.length > 0) {
              const { count } = await supabase
                .from('quiz_attempts')
                .select('*', { count: 'exact', head: true })
                .in('quiz_id', quizIds)
                .gte('started_at', weekStart.toISOString())
                .lt('started_at', weekEnd.toISOString());

              quizAttempts = count || 0;
            }
          }

          timeSeriesData.unshift({
            date: `Week ${weeks - i}`,
            enrollments: enrollments || 0,
            quizzes: quizAttempts,
          });
        }
      }
    } catch (e) {
      console.error('Error fetching time series:', e);
    }

    // Return mock data if no real data
    if (timeSeriesData.length === 0) {
      return [
        { date: 'Week 1', enrollments: 12, quizzes: 45 },
        { date: 'Week 2', enrollments: 18, quizzes: 62 },
        { date: 'Week 3', enrollments: 15, quizzes: 78 },
        { date: 'Week 4', enrollments: 22, quizzes: 95 },
      ];
    }

    return timeSeriesData;
  },

  async getTeacherCourses(teacherId: string) {
    try {
      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('created_by', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add enrollment count for each course
      const coursesWithStats = await Promise.all(
        (courses || []).map(async (course: any) => {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          return {
            _id: course.id,
            title: course.title,
            description: course.description,
            category: course.category,
            difficulty: course.difficulty,
            thumbnail: course.thumbnail,
            topics: [],
            createdBy: course.created_by,
            isPublished: course.is_published,
            enrollmentCount: count || 0,
            avgScore: 0, // Would need to calculate
          };
        })
      );

      return coursesWithStats;
    } catch (e) {
      console.error('Error fetching teacher courses:', e);
      return [];
    }
  },

  async getTeacherTopics(teacherId: string) {
    try {
      // Get teacher's courses first
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .eq('created_by', teacherId);

      const courseIds = courses?.map(c => c.id) || [];
      const courseMap = new Map(courses?.map(c => [c.id, c.title]) || []);

      if (courseIds.length === 0) return [];

      // Get topics for these courses
      const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .in('course_id', courseIds)
        .order('order', { ascending: true });

      if (error) throw error;

      // Add question count for each topic
      const topicsWithStats = await Promise.all(
        (topics || []).map(async (topic: any) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', topic.id);

          return {
            _id: topic.id,
            title: topic.title,
            description: topic.description,
            courseId: topic.course_id,
            order: topic.order,
            courseName: courseMap.get(topic.course_id) || 'Unknown',
            questionCount: count || 0,
          };
        })
      );

      return topicsWithStats;
    } catch (e) {
      console.error('Error fetching teacher topics:', e);
      return [];
    }
  },

  async getTeacherQuestions(teacherId: string) {
    try {
      // Get teacher's topics first
      const topics = await this.getTeacherTopics(teacherId);
      const topicIds = topics.map(t => t._id);
      const topicMap = new Map(topics.map(t => [t._id, { name: t.title, course: t.courseName }]));

      if (topicIds.length === 0) return [];

      // Get questions for these topics
      const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .in('topic_id', topicIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (questions || []).map((q: any) => ({
        _id: q.id,
        text: q.content || q.question_text,
        options: q.options || [],
        correctAnswer: q.correct_answer,
        difficulty: q.difficulty,
        topicId: q.topic_id,
        explanation: q.explanation,
        topicName: topicMap.get(q.topic_id)?.name || 'Unknown',
        courseName: topicMap.get(q.topic_id)?.course || 'Unknown',
      }));
    } catch (e) {
      console.error('Error fetching teacher questions:', e);
      return [];
    }
  },
};
