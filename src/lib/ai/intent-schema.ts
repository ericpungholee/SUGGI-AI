/**
 * Intent Classification Schema for Hybrid LLM Router
 * Defines the structure for intent classification with confidence scoring
 */

export interface IntentSlots {
  topic: string | null
  needs_recency: boolean
  target_docs: string[]
  edit_target: 'selection' | 'file' | 'section' | null
  outputs: 'answer' | 'links' | 'summary' | 'diff' | 'patch'
}

export interface IntentClassification {
  intent: 'ask' | 'web_search' | 'rag_query' | 'edit_request' | 'editor_write' | 'other'
  confidence: number
  slots: IntentSlots
}

export interface RouterContext {
  has_attached_docs: boolean
  doc_ids: string[]
  is_selection_present: boolean
  selection_length: number
  recent_tools: string[]
  conversation_length: number
  user_id: string
  document_id?: string
}

export interface RouterFeatures {
  has_docs: boolean
  max_sim: number
  volatile: boolean
  recent_tools: string[]
  selection_present: boolean
  conversation_context: boolean
}

export interface RouterResponse {
  classification: IntentClassification
  features: RouterFeatures
  processing_time: number
  fallback_used: boolean
}
