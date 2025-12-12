import { supabase } from '../config/supabase';
import { emailService } from './emailService';

export const courseService = {
  async getAllCourses(filters: any = {}) {
    let query = supabase.from('courses').select('*');

    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.difficulty) {
      query = query.eq('difficulty', filters.difficulty);
    }
    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    const { data: courses, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Map id to _id for frontend compatibility
    return courses.map(course => ({ ...course, _id: course.id }));
  },

  async getCourseById(courseId: string) {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (error) {
      throw new Error('Course not found');
    }

    return { ...course, _id: course.id };
  },

  async enrollCourse(userId: string, courseId: string) {
    // Check if already enrolled
    const { data: existing } = await supabase
      .from('enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (existing) {
      return { message: 'Already enrolled' };
    }

    const { error } = await supabase
      .from('enrollments')
      .insert([{ user_id: userId, course_id: courseId, enrolled_at: new Date() }]);

    if (error) {
      throw new Error(error.message);
    }

    // Fetch user and course details for email
    const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();
    const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();

    if (user && course) {
      await emailService.sendCourseEnrollmentEmail(user.email, user.name, course.title);
    }

    return { message: 'Enrolled successfully' };
  },

  async getEnrolledCourses(userId: string) {
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('course_id, courses(*)')
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return enrollments.map((e: any) => ({ ...e.courses, _id: e.courses.id }));
  },

  // ============ Teacher Course Management ============

  async createCourse(teacherId: string, courseData: any) {
    console.log('Creating course with data:', { teacherId, courseData });
    
    const insertData = {
      title: courseData.title,
      description: courseData.description || '',
      category: courseData.category || 'Other',
      difficulty: courseData.difficulty || 'Beginner',
      instructor_id: teacherId,
    };
    
    console.log('Insert data:', insertData);
    
    const { data: course, error } = await supabase
      .from('courses')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating course:', error);
      throw new Error(error.message);
    }

    console.log('Course created successfully:', course);
    return { ...course, _id: course.id, createdBy: course.instructor_id };
  },

  async updateCourse(teacherId: string, courseId: string, courseData: any) {
    // Verify ownership
    const { data: existing } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();

    if (!existing || existing.instructor_id !== teacherId) {
      throw new Error('Not authorized to update this course');
    }

    const { data: course, error } = await supabase
      .from('courses')
      .update({
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        difficulty: courseData.difficulty,
      })
      .eq('id', courseId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { ...course, _id: course.id, createdBy: course.instructor_id };
  },

  async deleteCourse(teacherId: string, courseId: string) {
    // Verify ownership
    const { data: existing } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();

    if (!existing || existing.instructor_id !== teacherId) {
      throw new Error('Not authorized to delete this course');
    }

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      throw new Error(error.message);
    }

    return { message: 'Course deleted successfully' };
  },

  // ============ Topic Management ============

  async getTopicsByCourse(courseId: string) {
    const { data: topics, error } = await supabase
      .from('topics')
      .select('*')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return topics.map(t => ({ ...t, _id: t.id }));
  },

  async createTopic(teacherId: string, topicData: any) {
    // Verify course ownership
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', topicData.courseId)
      .single();

    if (!course || course.instructor_id !== teacherId) {
      throw new Error('Not authorized to add topics to this course');
    }

    // Get next order number
    const { data: existingTopics } = await supabase
      .from('topics')
      .select('order')
      .eq('course_id', topicData.courseId)
      .order('order', { ascending: false })
      .limit(1);

    const nextOrder = existingTopics && existingTopics.length > 0 ? existingTopics[0].order + 1 : 1;

    const { data: topic, error } = await supabase
      .from('topics')
      .insert([{
        title: topicData.title,
        description: topicData.description,
        course_id: topicData.courseId,
        order: topicData.order || nextOrder,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { ...topic, _id: topic.id };
  },

  async updateTopic(teacherId: string, topicId: string, topicData: any) {
    // Get topic and verify course ownership
    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', topicId)
      .single();

    if (!topic) {
      throw new Error('Topic not found');
    }

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', topic.course_id)
      .single();

    if (!course || course.instructor_id !== teacherId) {
      throw new Error('Not authorized to update this topic');
    }

    const { data: updated, error } = await supabase
      .from('topics')
      .update({
        title: topicData.title,
        description: topicData.description,
        order: topicData.order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', topicId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { ...updated, _id: updated.id };
  },

  async deleteTopic(teacherId: string, topicId: string) {
    // Get topic and verify course ownership
    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', topicId)
      .single();

    if (!topic) {
      throw new Error('Topic not found');
    }

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', topic.course_id)
      .single();

    if (!course || course.instructor_id !== teacherId) {
      throw new Error('Not authorized to delete this topic');
    }

    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicId);

    if (error) {
      throw new Error(error.message);
    }

    return { message: 'Topic deleted successfully' };
  },

  // ============ Question Management ============

  async getQuestionsByTopic(topicId: string) {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return questions.map(q => ({
      _id: q.id,
      text: q.content || q.question_text,
      options: q.options || [],
      correctAnswer: q.correct_answer,
      difficulty: q.difficulty,
      topicId: q.topic_id,
      explanation: q.explanation,
    }));
  },

  async createQuestion(teacherId: string, questionData: any) {
    // Get topic and verify course ownership
    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', questionData.topicId)
      .single();

    if (!topic) {
      throw new Error('Topic not found');
    }

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', topic.course_id)
      .single();

    if (!course || course.instructor_id !== teacherId) {
      throw new Error('Not authorized to add questions to this topic');
    }

    const { data: question, error } = await supabase
      .from('questions')
      .insert([{
        content: questionData.text,
        question_text: questionData.text,
        options: questionData.options,
        correct_answer: questionData.correctAnswer,
        difficulty: questionData.difficulty,
        topic_id: questionData.topicId,
        explanation: questionData.explanation,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      _id: question.id,
      text: question.content || question.question_text,
      options: question.options,
      correctAnswer: question.correct_answer,
      difficulty: question.difficulty,
      topicId: question.topic_id,
      explanation: question.explanation,
    };
  },

  async updateQuestion(teacherId: string, questionId: string, questionData: any) {
    // Get question, topic, and verify course ownership
    const { data: question } = await supabase
      .from('questions')
      .select('topic_id')
      .eq('id', questionId)
      .single();

    if (!question) {
      throw new Error('Question not found');
    }

    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', question.topic_id)
      .single();

    if (!topic) {
      throw new Error('Topic not found');
    }

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', topic.course_id)
      .single();

    if (!course || course.instructor_id !== teacherId) {
      throw new Error('Not authorized to update this question');
    }

    const { data: updated, error } = await supabase
      .from('questions')
      .update({
        content: questionData.text,
        question_text: questionData.text,
        options: questionData.options,
        correct_answer: questionData.correctAnswer,
        difficulty: questionData.difficulty,
        explanation: questionData.explanation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      _id: updated.id,
      text: updated.content || updated.question_text,
      options: updated.options,
      correctAnswer: updated.correct_answer,
      difficulty: updated.difficulty,
      topicId: updated.topic_id,
      explanation: updated.explanation,
    };
  },

  async deleteQuestion(teacherId: string, questionId: string) {
    // Get question, topic, and verify course ownership
    const { data: question } = await supabase
      .from('questions')
      .select('topic_id')
      .eq('id', questionId)
      .single();

    if (!question) {
      throw new Error('Question not found');
    }

    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', question.topic_id)
      .single();

    if (!topic) {
      throw new Error('Topic not found');
    }

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', topic.course_id)
      .single();

    if (!course || course.instructor_id !== teacherId) {
      throw new Error('Not authorized to delete this question');
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      throw new Error(error.message);
    }

    return { message: 'Question deleted successfully' };
  },

  // ============ Teacher Data Fetching ============

  async getTeacherCourses(teacherId: string) {
    try {
      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add enrollment count and topic count for each course
      const coursesWithStats = await Promise.all(
        (courses || []).map(async (course: any) => {
          const { count: enrollmentCount } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          const { data: topics } = await supabase
            .from('topics')
            .select('id')
            .eq('course_id', course.id);

          return {
            _id: course.id,
            title: course.title,
            description: course.description,
            category: course.category,
            difficulty: course.difficulty,
            topics: topics?.map((t: any) => t.id) || [],
            createdBy: course.instructor_id,
            enrollmentCount: enrollmentCount || 0,
            avgScore: 0,
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
        .eq('instructor_id', teacherId);

      const courseIds = courses?.map((c: any) => c.id) || [];
      const courseMap = new Map(courses?.map((c: any) => [c.id, c.title]) || []);

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
      const topicIds = topics.map((t: any) => t._id);
      const topicMap = new Map(topics.map((t: any) => [t._id, { name: t.title, course: t.courseName }]));

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
