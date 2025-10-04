import { GPT_MODELS } from './core/models'

export interface RAGConfig {
  retrieval: {
    rag_topk: number
    mmr_lambda: number
    context_budget_ratio: number
    rag_min_conf_no_web: number
    rag_min_coverage_no_web: number
  }
  web: {
    primary: string
    fallbacks: string[]
    early_exit: {
      min_domains: number
      max_ms: number
    }
  }
  verification: {
    require_citations_for: string[]
    check_chunk_hash: boolean
  }
  models: {
    chat: string
    embedding: string
    routing: string
  }
}

export const defaultRAGConfig: RAGConfig = {
  retrieval: {
    rag_topk: 30,
    mmr_lambda: 0.7,
    context_budget_ratio: 0.7,
    rag_min_conf_no_web: 0.7,
    rag_min_coverage_no_web: 0.5
  },
  web: {
    primary: 'gpt_native',
    fallbacks: [],
    early_exit: {
      min_domains: 2,
      max_ms: 3500
    }
  },
  verification: {
    require_citations_for: ['summarize', 'fact_check', 'compare', 'reference_insert'],
    check_chunk_hash: true
  },
  models: {
    chat: GPT_MODELS.GPT5,
    embedding: GPT_MODELS.EMBEDDING,
    routing: GPT_MODELS.GPT5_NANO
  }
}

export function getRAGConfig(): RAGConfig {
  // In a real implementation, this could load from environment variables or a config file
  return {
    ...defaultRAGConfig,
    models: {
      chat: process.env.OPENAI_CHAT_MODEL || defaultRAGConfig.models.chat,
      embedding: process.env.OPENAI_EMBEDDING_MODEL || defaultRAGConfig.models.embedding,
      routing: process.env.OPENAI_ROUTING_MODEL || defaultRAGConfig.models.routing
    }
  }
}
