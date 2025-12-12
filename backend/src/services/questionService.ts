import { supabase } from '../config/supabase';

export interface CreateQuestionInput {
  topicId: string;
  questionText: string;
  questionType: 'multipleChoice' | 'shortAnswer';
  options?: string[];
  correctAnswer?: string;
  correctAnswers?: string[];
  explanation?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdBy: string;
}

export const questionService = {
  async createQuestion(input: CreateQuestionInput) {
    const { data, error } = await supabase
      .from('questions')
      .insert([{
        topic_id: input.topicId,
        content: input.questionText,
        question_type: input.questionType,
        options: input.options || [],
        correct_answer: input.correctAnswer || null,
        correct_answers: input.correctAnswers || [],
        hint: input.explanation || '',
        difficulty: input.difficulty,
        created_by: input.createdBy
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async getQuestionsByTopic(topicId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getQuestionById(questionId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error) throw new Error(error.message);
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
      throw new Error('You are not authorized to edit this question');
    }

    const updateData: any = {};
    if (updates.questionText) updateData.content = updates.questionText;
    if (updates.questionType) updateData.question_type = updates.questionType;
    if (updates.options) updateData.options = updates.options;
    if (updates.correctAnswer) updateData.correct_answer = updates.correctAnswer;
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
      throw new Error('You are not authorized to delete this question');
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) throw new Error(error.message);
    return { success: true };
  }
};
