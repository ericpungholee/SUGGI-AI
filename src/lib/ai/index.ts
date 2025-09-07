// OpenAI services
export { default as openai, generateChatCompletion, generateEmbedding, generateEmbeddings } from './openai'
export type { ChatMessage, ChatCompletionOptions, EmbeddingOptions } from './openai'

// Embedding services
export { 
  chunkText, 
  createEmbedding, 
  createEmbeddings, 
  processDocumentContent, 
  cosineSimilarity, 
  findSimilarChunks 
} from './embeddings'
export type { DocumentChunk, EmbeddingResult } from './embeddings'

// Vector search services
export { 
  searchSimilarDocuments, 
  getDocumentContext, 
  vectorizeDocument, 
  getDocumentStats 
} from './vector-search'
export type { SearchResult, DocumentSearchOptions } from './vector-search'

// Vector database services (PostgreSQL only)
// Pinecone removed for simplicity - using PostgreSQL for vector storage

// Document processing services
export { 
  processDocument, 
  processDocuments, 
  processAllUserDocuments, 
  getDocumentProcessingStatus, 
  cleanupOrphanedChunks 
} from './document-processor'
export type { DocumentProcessingOptions } from './document-processor'

// AI chat services
export { 
  processAIChat, 
  getConversationHistory, 
  getUserConversations, 
  deleteConversation 
} from './ai-chat'
export type { AIChatRequest, AIChatResponse, ConversationMessage } from './ai-chat'

// Web search services
export { 
  searchWeb, 
  searchNews, 
  searchAcademic, 
  formatSearchResultsForAI, 
  extractKeyInformation, 
  validateSearchQuery 
} from './web-search'
export type { WebSearchResult, WebSearchOptions } from './web-search'
