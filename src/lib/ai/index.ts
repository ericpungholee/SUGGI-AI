// Core AI services
export { getOpenAI, openai } from './core/openai-client'
export { generateChatCompletion, generateEmbedding, generateEmbeddings } from './openai'
export type { ChatMessage, ChatCompletionOptions, EmbeddingOptions } from './core/types'

// Web search services
export { webSearch, robustWebSearch, fallbackWebSearch } from './services/web-search'
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
// DocumentSearchOptions is exported from vector-search.ts

// Vector database services
export { vectorDB, storeDocumentInVectorDB, searchDocumentsInVectorDB } from './vector-db'
export type { VectorDocument } from './core/types'

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
export { routerService } from './router-service'
export type { IntentClassification, RouterContext, RouterFeatures, RouterResponse } from './core/types'

export { fillInstructionJSON, generateSystemPrompt, validateInstructionJSON, repairInstructionJSON } from './instruction-json'
export type { InstructionJSON, ContextRef } from './core/types'

export { verifyInstruction, validateResponse, generateVerificationReport } from './rag-verification'
export type { VerificationResult, VerificationOptions } from './core/types'

export { createRAGOrchestrator, processRAGQuery } from './rag-orchestrator'
export type { RAGResponse } from './core/types'

export { getRAGConfig } from './rag-config'
export type { RAGConfig } from './core/types'

// Unified Services
export { 
  unifiedSearchService, 
  unifiedSearch, 
  searchDocuments, 
  searchFolders 
} from './unified-search'
export type { 
  UnifiedSearchOptions, 
  UnifiedSearchResult 
} from './unified-search'


// MCP Tools
export { 
  createMCPTools 
} from './mcp-tools'
export type { 
  MCPTools 
} from './mcp-tools'
