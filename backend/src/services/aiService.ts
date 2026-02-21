import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/environment';

// Models to try in order — free-tier friendly first
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

// Lazy-initialize Gemini so the env var is always resolved at call time (Vercel sets env vars at runtime)
function getGenAI(): { genAI: GoogleGenerativeAI; apiKey: string } {
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('AI service is not configured. Please set GEMINI_API_KEY in environment variables.');
  }
  return { genAI: new GoogleGenerativeAI(apiKey), apiKey };
}

async function callWithFallback(fn: (modelName: string) => Promise<any>): Promise<any> {
  let lastError: any;
  for (const modelName of MODELS) {
    try {
      return await fn(modelName);
    } catch (error: any) {
      lastError = error;
      const is429 = error.status === 429 || error.message?.includes('429');
      const is404 = error.status === 404 || error.message?.includes('not found');
      if (is429 || is404) {
        console.warn(`[AI Service] Model ${modelName} returned ${error.status}, trying next model...`);
        continue;
      }
      throw error; // non-quota/non-404 errors should not fallback
    }
  }
  throw lastError;
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const aiService = {
  async generateQuestions(topicId: string, difficulty: string, count: number) {
    const { genAI } = getGenAI();

    console.log(`[AI Service] Generating ${count} questions for topic: ${topicId}, difficulty: ${difficulty}`);

    try {
      return await callWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });

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

        console.log(`[AI Service] Calling Gemini API (model: ${modelName})...`);
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
      });
    } catch (error: any) {
      console.error('[AI Service] Error generating questions:', error.message, error);
      
      // Provide more specific error messages
      if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
        throw new Error('Invalid API key. Please check your GEMINI_API_KEY configuration.');
      }
      if (error.status === 429 || error.message?.includes('429')) {
        throw new Error('API rate limit hit. Please wait a moment and try again.');
      }
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse AI response. The AI returned an invalid format.');
      }
      
      throw new Error(`AI generation failed: ${error.message || 'Unknown error'}`);
    }
  },

  async generateExplanation(question: string, answer: string) {
    let genAI: GoogleGenerativeAI;
    try {
      ({ genAI } = getGenAI());
    } catch {
      return "AI explanation is not available. Please configure the GEMINI_API_KEY.";
    }
    
    try {
      return await callWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `Explain why "${answer}" is the correct answer for the question: "${question}". Keep the explanation brief and educational.`;
      
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      });
    } catch (error) {
      console.error('[AI Service] Error generating explanation:', error);
      return "Unable to generate explanation at this time.";
    }
  },
  async chatAssistant(messages: ChatMessage[]) {
    const { genAI } = getGenAI();

    const systemPrompt =
      'You are the QuizShield assistant. Your job is to explain quiz rules, '
      + 'anti-cheating policies, and help users navigate features like joining quizzes, '
      + 'viewing reports/analytics, and moving through student and teacher pages. '
      + 'Never provide help to cheat, bypass monitoring, or break rules. If asked, '
      + 'refuse briefly and offer allowed guidance. Keep responses concise and helpful.';

    console.log('[AI Service] Calling Gemini API for chat assistant...');

    try {
      return await callWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });

        // Convert chat messages to Gemini format
        const geminiHistory = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(0, -1) // all except the last message
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        const lastMessage = messages[messages.length - 1];

        const chat = model.startChat({
          history: [
            { role: 'user', parts: [{ text: 'System instruction: ' + systemPrompt }] },
            { role: 'model', parts: [{ text: 'Understood. I will follow these guidelines.' }] },
            ...geminiHistory,
          ],
        });

        console.log(`[AI Service] Calling Gemini chat (model: ${modelName})...`);
        const result = await chat.sendMessage(lastMessage.content);
        const response = await result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Gemini returned an empty response.');
        }

        console.log('[AI Service] Gemini chat response received, length:', text.length);
        return text.trim();
      });
    } catch (error: any) {
      console.error('[AI Service] Gemini chat error:', error.message, error);

      if (error.message?.includes('API key not valid') || error.message?.includes('API_KEY_INVALID')) {
        throw new Error('Gemini API key is invalid. Please check your GEMINI_API_KEY.');
      }
      if (error.status === 429 || error.message?.includes('429')) {
        throw new Error('API rate limit hit. Please wait a moment and try again.');
      }

      throw new Error(`AI assistant error: ${error.message || 'Unknown error'}`);
    }
  }
};
