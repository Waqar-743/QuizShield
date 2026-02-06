import { Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { asyncHandler } from '../middleware/errorHandler';

export const generateQuestions = asyncHandler(async (req: Request, res: Response) => {
  const { topicId, difficulty, count, questionType } = req.body;
  
  // Validate required fields
  if (!topicId) {
    res.status(400).json({
      success: false,
      error: { message: 'topicId is required' }
    });
    return;
  }

  console.log(`[AI Controller] Request to generate questions:`, { topicId, difficulty, count, questionType });

  try {
    const questions = await aiService.generateQuestions(
      topicId,
      difficulty || 'Medium',
      count || 5
    );
    
    console.log(`[AI Controller] Successfully generated ${questions.length} questions`);
    
    res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error: any) {
    console.error(`[AI Controller] Error:`, error.message);
    
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to generate questions',
        code: 'AI_GENERATION_ERROR'
      }
    });
  }
});

export const getHint = asyncHandler(async (req: Request, res: Response) => {
  // Placeholder
  res.status(200).json({
    success: true,
    data: { hint: "AI Hint generation not implemented yet." },
  });
});

export const explainConcept = asyncHandler(async (req: Request, res: Response) => {
  const { concept } = req.body;
  // Placeholder
  res.status(200).json({
    success: true,
    data: { explanation: `Explanation for ${concept} coming soon.` },
  });
});

export const getRecommendations = asyncHandler(async (req: Request, res: Response) => {
  // Return mock recommendations for now
  res.status(200).json({
    success: true,
    data: [
      {
        id: '1',
        type: 'topic',
        title: 'Review JavaScript Closures',
        description: 'Based on your quiz performance, we recommend reviewing closures.',
        priority: 'high',
        topicId: 'js-closures-1',
      },
      {
        id: '2',
        type: 'practice',
        title: 'Practice Array Methods',
        description: 'You scored 65% on array methods. More practice recommended.',
        priority: 'medium',
        topicId: 'js-arrays-1',
      },
      {
        id: '3',
        type: 'course',
        title: 'Explore React Hooks',
        description: 'Based on your interests, you might enjoy learning React Hooks.',
        priority: 'low',
        courseId: 'react-hooks-1',
      },
    ],
  });
});

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  // Return mock insights for the student dashboard
  res.status(200).json({
    success: true,
    data: {
      strengths: [
        { topic: 'JavaScript Basics', score: 92 },
        { topic: 'HTML & CSS', score: 88 },
        { topic: 'Git Fundamentals', score: 85 },
      ],
      weaknesses: [
        { topic: 'Advanced React', score: 45, suggestion: 'Review component lifecycle and hooks' },
        { topic: 'Data Structures', score: 52, suggestion: 'Practice with trees and graphs' },
        { topic: 'Algorithms', score: 58, suggestion: 'Focus on sorting and searching algorithms' },
      ],
      studyPlan: [
        { day: 'Monday', topic: 'React Hooks Review', duration: '45 min' },
        { day: 'Tuesday', topic: 'Data Structures Practice', duration: '60 min' },
        { day: 'Wednesday', topic: 'Algorithm Challenges', duration: '45 min' },
        { day: 'Thursday', topic: 'Project Work', duration: '90 min' },
        { day: 'Friday', topic: 'Quiz Practice', duration: '30 min' },
      ],
      overallProgress: 68,
      weeklyGoal: 5,
      weeklyCompleted: 3,
    },
  });
});

export const chatAssistant = asyncHandler(async (req: Request, res: Response) => {
  const { messages } = req.body as { messages?: { role: string; content: string }[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      success: false,
      error: { message: 'messages array is required' }
    });
    return;
  }

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const lastContent = lastUserMessage?.content ?? '';

  const riskyPattern = /(bypass|avoid detection|disable monitoring|circumvent|cheat|hack|exploit|get answers|leak|steal)/i;
  if (riskyPattern.test(lastContent)) {
    res.status(200).json({
      success: true,
      data: {
        reply:
          'I cannot help with cheating or bypassing quiz rules. I can explain the rules, how violations work, and how to use the app features.'
      }
    });
    return;
  }

  const normalizedMessages = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10);

  const reply = await aiService.chatAssistant(normalizedMessages as any);

  res.status(200).json({
    success: true,
    data: { reply }
  });
});
