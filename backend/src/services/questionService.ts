import { supabase } from '../config/supabase';
import { courseService } from './courseService';
const forbidden = () => Object.assign(new Error('Not authorized to access this question bank'), {statusCode:403});

export interface CreateQuestionInput {
  topicId: string;
  questionText: string;
  questionType: 'multipleChoice' | 'shortAnswer';
  options?: string[];
  correctAnswer?: string | number | null;
  correctAnswers?: string[];
  explanation?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdBy: string;
}

export const questionService = {
  async createQuestion(input: CreateQuestionInput) {
    return courseService.createQuestion(input.createdBy, { topicId:input.topicId, text:input.questionText,
      questionType:input.questionType, options:input.options, correctAnswer:input.correctAnswer,
      correctAnswers:input.correctAnswers, explanation:input.explanation, difficulty:input.difficulty });
  },

  async getQuestionsByTopic(topicId: string, teacherId: string) {
    const {data:topic}=await supabase.from('topics').select('course_id').eq('id',topicId).single();
    const {data:course}=await supabase.from('courses').select('created_by').eq('id',topic?.course_id).single();
    if(!topic || course?.created_by!==teacherId) throw forbidden();
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getQuestionById(questionId: string, teacherId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error) throw new Error(error.message);
    if (!data || data.created_by !== teacherId) throw forbidden();
    return data;
  },

  async updateQuestion(questionId: string, updates: Partial<CreateQuestionInput>, userId: string) {
    // First check if user owns this question
    const { data: existing } = await supabase
      .from('questions')
      .select('created_by')
      .eq('id', questionId)
      .single();

    if (!existing || existing.created_by !== userId) {
      throw forbidden();
    }

    const updateData: any = {};
    if (updates.questionText) updateData.content = updates.questionText;
    if (updates.questionType) updateData.question_type = updates.questionType;
    if (updates.options) updateData.options = updates.options;
    if (updates.correctAnswer !== undefined) updateData.correct_answer = updates.correctAnswer;
    if (updates.correctAnswers) updateData.correct_answers = updates.correctAnswers;
    if (updates.explanation) updateData.hint = updates.explanation;
    if (updates.difficulty) updateData.difficulty = updates.difficulty;

    const { data, error } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteQuestion(questionId: string, userId: string) {
    // First check if user owns this question
    const { data: existing } = await supabase
      .from('questions')
      .select('created_by')
      .eq('id', questionId)
      .single();

    if (!existing || existing.created_by !== userId) {
      throw forbidden();
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) throw new Error(error.message);
    return { success: true };
  }
};
