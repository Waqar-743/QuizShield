import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/environment';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const aiService = {
  async generateQuestions(topicId: string, difficulty: string, count: number) {
    // Check if API key is configured
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.error('GEMINI_API_KEY is not configured properly');
      throw new Error('AI service is not configured. Please set a valid GEMINI_API_KEY in the environment.');
    }

    if (!genAI) {
      throw new Error('AI service initialization failed');
    }

    console.log(`[AI Service] Generating ${count} questions for topic: ${topicId}, difficulty: ${difficulty}`);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Generate ${count} multiple-choice questions about "${topicId}" at a "${difficulty}" difficulty level. 
      Format the output as a JSON array of objects with the following structure:
      [
        {
          "content": "Question text here",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer_index": 0,
          "explanation": "Brief explanation",
          "hint": "A helpful hint"
        }
      ]
      The correct_answer_index should be a 0-based integer matching the index in the options array.
      Do not include any markdown formatting or code blocks, just the raw JSON string.`;

      console.log('[AI Service] Calling Gemini API...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('[AI Service] Raw response received:', text.substring(0, 200) + '...');
      
      // Clean up the text if it contains markdown code blocks
      let jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Try to extract JSON array if wrapped in other content
      const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      const questions = JSON.parse(jsonString);
      console.log(`[AI Service] Successfully parsed ${questions.length} questions`);
      
      return questions;
    } catch (error: any) {
      console.error('[AI Service] Error generating questions:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('API key')) {
        throw new Error('Invalid API key. Please check your GEMINI_API_KEY configuration.');
      }
      if (error.message?.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later.');
      }
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse AI response. The AI returned an invalid format.');
      }
      
      throw new Error(`AI generation failed: ${error.message || 'Unknown error'}`);
    }
  },

  async generateExplanation(question: string, answer: string) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || !genAI) {
      return "AI explanation is not available. Please configure the GEMINI_API_KEY.";
    }
    
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Explain why "${answer}" is the correct answer for the question: "${question}". Keep the explanation brief and educational.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('[AI Service] Error generating explanation:', error);
      return "Unable to generate explanation at this time.";
    }
  },
  async chatAssistant(messages: ChatMessage[]) {
    const openRouterKey = config.openRouterApiKey;
    if (!openRouterKey) {
      console.error('[AI Service] OPENROUTER_API_KEY is not set in environment variables');
      throw new Error('AI assistant is not configured. Please set the OPENROUTER_API_KEY environment variable on your Vercel deployment.');
    }

    const systemPrompt =
      'You are the QuizShield assistant. Your job is to explain quiz rules, '
      + 'anti-cheating policies, and help users navigate features like joining quizzes, '
      + 'viewing reports/analytics, and moving through student and teacher pages. '
      + 'Never provide help to cheat, bypass monitoring, or break rules. If asked, '
      + 'refuse briefly and offer allowed guidance. Keep responses concise and helpful.';

    const payload = {
      model: config.openRouterModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.2,
      max_tokens: 400,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'X-Title': config.openRouterAppName,
    };

    const referer = config.openRouterAppUrl || config.frontendUrl;
    if (referer) {
      headers['HTTP-Referer'] = referer;
    }

    console.log('[AI Service] Calling OpenRouter API with model:', config.openRouterModel);
    console.log('[AI Service] API key present:', !!openRouterKey, 'length:', openRouterKey.length);

    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (fetchError: any) {
      console.error('[AI Service] Network error calling OpenRouter:', fetchError.message);
      throw new Error(`Failed to reach AI service: ${fetchError.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Service] OpenRouter API error: ${response.status}`, errorText);

      if (response.status === 401 || response.status === 403) {
        throw new Error('OpenRouter API key is invalid or expired. Please update OPENROUTER_API_KEY in your Vercel environment variables and redeploy.');
      }
      if (response.status === 429) {
        throw new Error('AI rate limit reached. Please try again in a moment.');
      }
      throw new Error(`AI service error (${response.status}). Please check server logs.`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[AI Service] OpenRouter returned unexpected response:', JSON.stringify(data));
      throw new Error('AI returned an empty response. The model may be temporarily unavailable.');
    }

    return content.trim();
  }
};
