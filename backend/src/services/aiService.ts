import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/environment';

// Initialize Gemini API
const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
    if (!apiKey || !genAI) {
      console.error('[AI Service] GEMINI_API_KEY is not set or Gemini failed to initialize');
      throw new Error('AI assistant is not configured. Please set the GEMINI_API_KEY environment variable.');
    }

    const systemPrompt =
      'You are the QuizShield assistant. Your job is to explain quiz rules, '
      + 'anti-cheating policies, and help users navigate features like joining quizzes, '
      + 'viewing reports/analytics, and moving through student and teacher pages. '
      + 'Never provide help to cheat, bypass monitoring, or break rules. If asked, '
      + 'refuse briefly and offer allowed guidance. Keep responses concise and helpful.';

    console.log('[AI Service] Calling Gemini API for chat assistant...');

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      console.log('[AI Service] Gemini chat response received, length:', text.length);
      return text.trim();
    } catch (error: any) {
      console.error('[AI Service] Gemini chat error:', error.message);

      if (error.message?.includes('API key')) {
        throw new Error('Gemini API key is invalid. Please check your GEMINI_API_KEY.');
      }
      if (error.message?.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later.');
      }

      throw new Error(`AI assistant error: ${error.message || 'Unknown error'}`);
    }
  }
};
