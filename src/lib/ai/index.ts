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

// Vector database services
export { vectorDB, storeDocumentInVectorDB, searchDocumentsInVectorDB } from './vector-db'
export type { VectorDocument, VectorSearchResult, VectorSearchOptions } from './vector-db'

// Document processing services
export { 
  processDocument, 
  processDocuments, 
  processAllUserDocuments, 
  getDocumentProcessingStatus, 
  cleanupOrphanedChunks 
} from './document-processor'
export type { DocumentProcessingOptions } from './document-processor'

// Incremental vectorization services
export { 
  vectorizeDocumentIncremental, 
  getVectorizationStatus, 
  batchVectorizeDocuments 
} from './incremental-vectorization'
export type { VectorizationResult } from './incremental-vectorization'

// New RAG System
export { ragAdapter, buildEvidenceBundle } from './rag-adapter'
export type { RagChunk } from './rag-adapter'

// Hybrid Learned Router System
export { hybridLearnedRouter } from './hybrid-learned-router'
export { embeddingService } from './embedding-service'
export { learnedClassifier } from './learned-classifier'
export { llmMetaClassifier } from './llm-meta-classifier'
export { routerService } from './router-service'
export type { IntentClassification, RouterContext, RouterFeatures, RouterResponse } from './intent-schema'

export { fillInstructionJSON, generateSystemPrompt, validateInstructionJSON, repairInstructionJSON } from './instruction-json'
export type { InstructionJSON, ContextRef } from './instruction-json'

export { verifyInstruction, validateResponse, generateVerificationReport } from './rag-verification'
export type { VerificationResult, VerificationOptions } from './rag-verification'

export { createRAGOrchestrator, processRAGQuery } from './rag-orchestrator'
export type { RAGOrchestratorOptions, RAGResponse } from './rag-orchestrator'

export { getRAGConfig } from './rag-config'
export type { RAGConfig } from './rag-config'
