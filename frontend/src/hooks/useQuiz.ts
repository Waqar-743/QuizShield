import { useState, useCallback } from 'react';
import api from '../services/api';
import { Quiz, QuizAttempt, Question } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const useQuiz = () => {
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const startQuiz = useCallback(async (topicId: string) => {
    setLoading(true);
    try {
      // 1. Generate or fetch a quiz for the topic
      const quizResponse = await api.post('/quizzes/generate', { topicId });
      const quiz = quizResponse.data.data;
      setCurrentQuiz(quiz);

      // 2. Start an attempt
      const attemptResponse = await api.post(`/quizzes/${quiz._id}/attempt`);
      const attempt = attemptResponse.data.data;
      setCurrentAttempt(attempt);

      // 3. Get the first question (adaptive)
      const questionResponse = await api.get(`/quizzes/${quiz._id}/next-question`, {
        params: { attemptId: attempt._id }
      });
      
      if (questionResponse.data.data) {
        setCurrentQuestion(questionResponse.data.data);
        navigate(`/quiz/${quiz._id}/attempt/${attempt._id}`);
      } else {
        toast.error('No questions available for this quiz.');
      }

      setError(null);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to start quiz';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const submitAnswer = useCallback(async (quizId: string, attemptId: string, questionId: string, answer: string) => {
    setLoading(true);
    try {
      const response = await api.post(`/quizzes/${quizId}/submit-answer`, {
        attemptId,
        questionId,
        selectedAnswer: answer
      });

      const result = response.data.data;
      
      // If quiz is completed
      if (result.isComplete) {
        toast.success('Quiz completed!');
        navigate(`/quiz/results/${attemptId}`);
        return null;
      }

      // If not complete, fetch next question
      const nextQResponse = await api.get(`/quizzes/${quizId}/next-question`, {
        params: { attemptId }
      });
      
      if (nextQResponse.data.data) {
        setCurrentQuestion(nextQResponse.data.data);
      } else {
        // Fallback if no next question but not marked complete (shouldn't happen often)
        navigate(`/quiz/results/${attemptId}`);
      }

      return result; // Return result for immediate feedback if needed
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit answer';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const getAttemptResults = useCallback(async (attemptId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/quizzes/attempt/${attemptId}`);
      setCurrentAttempt(response.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  }, []);

  const getHint = useCallback(async (_questionId: string) => {
    // This would ideally call an endpoint to get a hint if not already present
    // For now, we assume the hint might be in the question object or fetched separately
    // Implementing a placeholder fetch
    try {
        // In a real app, you might have a specific endpoint for hints to avoid spoiling it in the initial payload
        // const response = await api.get(`/questions/${questionId}/hint`);
        // return response.data.hint;
        return "Think about the core concepts discussed in the topic.";
    } catch (error) {
        console.error(error);
        return "No hint available.";
    }
  }, []);

  return {
    currentQuiz,
    currentAttempt,
    currentQuestion,
    loading,
    error,
    startQuiz,
    submitAnswer,
    getAttemptResults,
    getHint
  };
};
