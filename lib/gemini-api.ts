import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CompletionRequest {
  text: string;
  cursorPosition: number;
}

export interface CompletionResponse {
  suggestion: string;
  confidence: number;
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  initialize(apiKey: string): boolean {
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  async getCompletion(request: CompletionRequest): Promise<CompletionResponse | null> {
    if (!this.isInitialized()) {
      return null;
    }

    try {
      const { text, cursorPosition } = request;
      const beforeCursor = text.substring(0, cursorPosition);
      const afterCursor = text.substring(cursorPosition);
      
      // Create a prompt for text completion
      const prompt = this.createCompletionPrompt(beforeCursor, afterCursor);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const suggestion = response.text().trim();
      
      // Filter out suggestions that are too long or don't make sense
      if (suggestion.length > 100 || suggestion.includes('\n\n')) {
        return null;
      }
      
      return {
        suggestion,
        confidence: 0.8 // Simple confidence score
      };
    } catch (error) {
      console.error('Gemini completion error:', error);
      return null;
    }
  }

  private createCompletionPrompt(beforeCursor: string, afterCursor: string): string {
    const lastLines = beforeCursor.split('\n').slice(-3).join('\n');
    const nextLines = afterCursor.split('\n').slice(0, 2).join('\n');
    
    return `You are a helpful text completion assistant. Complete the following text naturally and concisely.

Context before cursor:
${lastLines}

Context after cursor:
${nextLines}

Provide only the completion text that should be inserted at the cursor position. Keep it short (1-20 words max) and contextually appropriate. Do not repeat existing text.

Completion:`;
  }

  async getSuggestion(text: string, cursorPosition: number): Promise<string | null> {
    const completion = await this.getCompletion({ text, cursorPosition });
    return completion?.suggestion || null;
  }
}

export const geminiService = new GeminiService();
