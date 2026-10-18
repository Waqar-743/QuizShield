import { Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { asyncHandler } from '../middleware/errorHandler';
import { config } from '../config/environment';

export const generateQuestions = asyncHandler(async (req: Request, res: Response) => {
  if(!config.geminiApiKey) throw Object.assign(new Error('AI question generation is not configured. Your teacher can add questions manually.'),{statusCode:503});
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
    console.error('AI question generation failed');
    
    res.status(500).json({
      success: false,
      error: {
        message: 'AI question generation is temporarily unavailable. Please try again later.',
        code: 'AI_GENERATION_ERROR'
      }
    });
  }
});

export const getHint = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json({success:false,error:{message:'AI hints are not available in this deployment.'}});
});

export const explainConcept = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json({success:false,error:{message:'Concept explanations are not available in this deployment.'}});
});

export const getRecommendations = asyncHandler(async (_req: Request, res: Response) => {
  res.json({success:true,data:[],dataAvailable:false});
});

export const getInsights = asyncHandler(async (_req: Request, res: Response) => {
  res.json({success:true,data:{strengths:[],weaknesses:[],studyPlan:[],overallProgress:null,weeklyGoal:null,weeklyCompleted:null},dataAvailable:false});
});

export const chatAssistant = asyncHandler(async (req: Request, res: Response) => {
  if(!config.geminiApiKey) throw Object.assign(new Error('The AI assistant is not configured in this deployment.'),{statusCode:503});
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

  try {
    const reply = await aiService.chatAssistant(normalizedMessages as any);

    res.status(200).json({
      success: true,
      data: { reply }
    });
  } catch (error: any) {
    console.error('AI assistant request failed');

    res.status(500).json({
      success: false,
      error: {
        message: 'The AI assistant is temporarily unavailable. Please try again later.',
        code: 'AI_ASSISTANT_ERROR'
      }
    });
  }
});
