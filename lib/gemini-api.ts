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
      this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
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
      console.warn('Gemini API not initialized');
      return null;
    }

    try {
      const { text, cursorPosition } = request;
      const beforeCursor = text.substring(0, cursorPosition);
      const afterCursor = text.substring(cursorPosition);
      
      // Skip completion for very short text or at the beginning
      if (beforeCursor.length < 20) {
        console.log('🚫 Skipping API call: text too short (<20 chars)');
        return null;
      }
      
      // // Skip if the text ends with punctuation that doesn't need completion
      // if (/[.!?;:]$/.test(beforeCursor.trim())) {
      //   console.log('🚫 Skipping API call: ends with punctuation');
      //   return null;
      // }
      
      // // Skip if user is likely still typing a word (no space at end)
      // if (beforeCursor.length > 20 && !/\s$/.test(beforeCursor)) {
      //   console.log('🚫 Skipping API call: not at word boundary');
      //   return null;
      // }
      
      console.log('🚀 Sending request to Gemini API...');
      
      // Create a prompt for text completion
      const prompt = this.createCompletionPrompt(beforeCursor, afterCursor);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let suggestion = response.text().trim();
      
      console.log('📝 Raw API response:', suggestion);
      
      // Handle space token replacement
      if (suggestion.startsWith('[SPACE]')) {
        // Remove '[SPACE]' token and replace with a single space
        // If there's already a space after [SPACE], don't add another one
        const afterToken = suggestion.substring(7);
        suggestion = afterToken.startsWith(' ') ? afterToken : ' ' + afterToken;
        console.log('🔄 Processed space token, final suggestion:', JSON.stringify(suggestion));
      }
      
      // Filter out suggestions that are too long or don't make sense
      if (suggestion.length > 100 || suggestion.includes('\n\n')) {
        console.log('🚫 Filtering out suggestion: too long or contains line breaks');
        return null;
      }
      
      console.log('✨ Returning valid suggestion:', JSON.stringify(suggestion));
      return {
        suggestion,
        confidence: 0.8 // Simple confidence score
      };
    } catch (error) {
      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Gemini completion error:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      } else {
        console.error('Unknown Gemini completion error:', error);
      }
      return null;
    }
  }

  private createCompletionPrompt(beforeCursor: string, afterCursor: string): string {
    const lastLines = beforeCursor.split('\n').slice(-3).join('\n');
    const nextLines = afterCursor.split('\n').slice(0, 2).join('\n');
    
    // Check if we need a leading space
    const needsSpace = beforeCursor.length > 0 && 
                      !/\s$/.test(beforeCursor) && 
                      !/[.!?,:;]$/.test(beforeCursor);
    
    const spaceInstruction = needsSpace ? 
      "If you're suggesting new words (not completing the current word), start your response with '[SPACE]' followed by your suggestion." : 
      "";
    return `You are a helpful text completion assistant. Complete the following text naturally and concisely.

Context before cursor:
${lastLines}

Context after cursor:
${nextLines}

Provide only the completion text that should be inserted at the cursor position. Keep it short (1-20 words max) and contextually appropriate. Do not repeat existing text. ${spaceInstruction}

Completion:`;
  }

  async getSuggestion(text: string, cursorPosition: number): Promise<string | null> {
    const completion = await this.getCompletion({ text, cursorPosition });
    return completion?.suggestion || null;
  }
}

export const geminiService = new GeminiService();
