// Core AI services
export { getOpenAI, openai } from './core/openai-client'
export { generateChatCompletion, generateEmbedding, generateEmbeddings } from './openai'
export type { ChatMessage, ChatCompletionOptions, EmbeddingOptions } from './core/types'

// Web search services
export { webSearch, robustWebSearch } from './services/web-search'
export type { WebSearchOptions, WebSearchResult, Citation } from './core/types'

// Embedding services
export { 
  chunkText, 
  createEmbedding, 
  createEmbeddings, 
  processDocumentContent, 
  cosineSimilarity, 
  findSimilarChunks 
} from './embeddings'
export type { DocumentChunk, EmbeddingResult } from './core/types'

// Vector search services
export { 
  searchSimilarDocuments, 
  getDocumentContext, 
  vectorizeDocument, 
  getDocumentStats 
} from './vector-search'
export type { SearchResult, DocumentSearchOptions } from './core/types'

// Vector database services
export { vectorDB, storeDocumentInVectorDB, searchDocumentsInVectorDB } from './vector-db'
export type { VectorDocument, VectorSearchResult, VectorSearchOptions } from './core/types'

// Document processing services
export { 
  processDocument, 
  processDocuments, 
  processAllUserDocuments, 
  getDocumentProcessingStatus, 
  cleanupOrphanedChunks 
} from './document-processor'
export type { DocumentProcessingOptions } from './core/types'

// Incremental vectorization services
export { 
  vectorizeDocumentIncremental, 
  getVectorizationStatus, 
  batchVectorizeDocuments 
} from './incremental-vectorization'
export type { VectorizationResult } from './core/types'

// New RAG System
export { ragAdapter, buildEvidenceBundle } from './rag-adapter'
export type { RagChunk } from './core/types'

// Hybrid Learned Router System
export { hybridLearnedRouter } from './hybrid-learned-router'
export { embeddingService } from './embedding-service'
export { learnedClassifier } from './learned-classifier'
export { llmMetaClassifier } from './llm-meta-classifier'
export { routerService } from './router-service'
export type { IntentClassification, RouterContext, RouterFeatures, RouterResponse } from './core/types'

export { fillInstructionJSON, generateSystemPrompt, validateInstructionJSON, repairInstructionJSON } from './instruction-json'
export type { InstructionJSON, ContextRef } from './core/types'

export { verifyInstruction, validateResponse, generateVerificationReport } from './rag-verification'
export type { VerificationResult, VerificationOptions } from './core/types'

export { createRAGOrchestrator, processRAGQuery } from './rag-orchestrator'
export type { RAGOrchestratorOptions, RAGResponse } from './core/types'

export { getRAGConfig } from './rag-config'
export type { RAGConfig } from './core/types'
