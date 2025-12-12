import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

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
          "correct_answer": "Option A",
          "hint": "A helpful hint"
        }
      ]
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
  }
};
