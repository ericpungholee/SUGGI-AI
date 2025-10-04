import OpenAI from 'openai';

// Global OpenAI client instance
let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiInstance = new OpenAI({
      apiKey,
    });
  }
  return openaiInstance;
}

// Export the client getter as default
export const openai = getOpenAI();

// Re-export types for convenience
export type { ChatMessage, ChatCompletionOptions, EmbeddingOptions } from '../openai';
