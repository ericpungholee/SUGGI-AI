/**
 * Centralized GPT model configuration
 * All AI modules should use these constants for consistency
 */

export const GPT_MODELS = {
  // Primary models
  GPT5: 'gpt-5-2025-08-07',
  GPT5_NANO: 'gpt-5-nano-2025-08-07',
  
  // Embedding models
  EMBEDDING: 'text-embedding-3-small',
  
  // Fallback models
  GPT4O: 'gpt-4o-2024-08-06',
} as const;

export const MODEL_CONFIG = {
  // Chat completion models
  CHAT: {
    PRIMARY: GPT_MODELS.GPT5,
    FAST: GPT_MODELS.GPT5_NANO,
    FALLBACK: GPT_MODELS.GPT4O,
  },
  
  // Routing and classification models (faster, cheaper)
  ROUTING: {
    PRIMARY: GPT_MODELS.GPT5_NANO,
  },
  
  // Embedding models
  EMBEDDING: {
    PRIMARY: GPT_MODELS.EMBEDDING,
  },
  
  // Web search models
  WEB_SEARCH: {
    PRIMARY: GPT_MODELS.GPT5,
  },
} as const;

// Helper functions for getting the right model
export function getChatModel(useFast = false): string {
  return useFast ? MODEL_CONFIG.CHAT.FAST : MODEL_CONFIG.CHAT.PRIMARY;
}

export function getRoutingModel(): string {
  return MODEL_CONFIG.ROUTING.PRIMARY;
}

export function getEmbeddingModel(): string {
  return MODEL_CONFIG.EMBEDDING.PRIMARY;
}

export function getWebSearchModel(): string {
  return MODEL_CONFIG.WEB_SEARCH.PRIMARY;
}
