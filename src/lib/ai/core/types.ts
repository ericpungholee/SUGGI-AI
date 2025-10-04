// Common types used across AI modules

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  abortSignal?: AbortSignal;
  useWebSearch?: boolean;
  tools?: Array<{ type: string; [key: string]: any }>;
  tool_choice?: 'auto' | { type: string };
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface Citation {
  title?: string;
  url: string;
  domain?: string;
  snippet?: string;
  published_date?: string;
}

export interface WebSearchOptions {
  prompt: string;
  model?: string;
  timeoutMs?: number;
  maxResults?: number;
  includeImages?: boolean;
  searchRegion?: string;
  language?: string;
}

export interface WebSearchResult {
  text: string;
  citations: Citation[];
  requestId: string | null;
  usage: any;
  model: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  docId: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface SearchResult {
  id: string;
  text: string;
  docId: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface DocumentSearchOptions {
  topK?: number;
  threshold?: number;
  projectId?: string;
  userId?: string;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface VectorSearchOptions {
  topK?: number;
  threshold?: number;
  filter?: Record<string, any>;
}

export interface DocumentProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  userId?: string;
  projectId?: string;
}

export interface VectorizationResult {
  success: boolean;
  chunksProcessed: number;
  error?: string;
}

export interface RagChunk {
  id: string;
  text: string;
  docId: string;
  anchor?: string;
  similarity?: number;
}

export interface IntentClassification {
  intent: 'ask' | 'web_search' | 'rag_query' | 'edit_request' | 'other';
  confidence: number;
  slots?: {
    topic?: string;
    recency_needs?: 'none' | 'recent' | 'current';
    target_docs?: string[];
    edit_targets?: string[];
    outputs?: string[];
  };
}

export interface RouterContext {
  has_attached_docs: boolean;
  doc_ids: string[];
  is_selection_present: boolean;
  selection_length: number;
  recent_tools: string[];
  conversation_length: number;
  user_id: string;
  document_id?: string;
}

export interface RouterFeatures {
  needs_web: number;
  needs_docs: number;
  is_edit: number;
  is_question: number;
  urgency: number;
}

export interface RouterResponse {
  classification: IntentClassification;
  features: RouterFeatures;
  explanation?: string;
  confidence_breakdown?: Record<string, number>;
}

export interface InstructionJSON {
  task: string;
  context_refs: Array<{
    type: 'doc' | 'web';
    id: string;
    title: string;
    relevance: number;
  }>;
  constraints: string[];
  outputs: string[];
  quality_checks: string[];
}

export interface ContextRef {
  type: 'doc' | 'web';
  id: string;
  title: string;
  relevance: number;
}

export interface VerificationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface VerificationOptions {
  strict_mode?: boolean;
  check_citations?: boolean;
  validate_facts?: boolean;
}

export interface RAGOrchestratorOptions {
  userId: string;
  documentId?: string;
  projectId?: string;
  useWebSearch?: boolean;
  useDocuments?: boolean;
  maxContextLength?: number;
}

export interface RAGResponse {
  content: string;
  citations: string[];
  sources: Array<{
    type: 'doc' | 'web';
    id: string;
    title: string;
    url?: string;
  }>;
  confidence: number;
  reasoning?: string;
}

export interface RAGConfig {
  models: {
    chat: string;
    embedding: string;
    routing: string;
  };
  thresholds: {
    similarity: number;
    confidence: number;
    relevance: number;
  };
  limits: {
    maxChunks: number;
    maxContextLength: number;
    maxWebResults: number;
  };
  features: {
    useWebSearch: boolean;
    useDocuments: boolean;
    useCaching: boolean;
  };
}
