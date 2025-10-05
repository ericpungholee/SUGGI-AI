/**
 * MCP Tools Implementation
 * Provides tool interfaces for document operations as specified in Writer Agent V2
 */

import { ragAdapter, RagChunk } from './rag-adapter'

export interface MCPTools {
  search_docs: (query: string, k?: number) => Promise<{ chunks: RagChunk[] }>
  pack_context: (ids: string[], budgetTokens?: number) => Promise<{ chunks: RagChunk[] }>
  apply_ops: (pending_change_id: string) => Promise<{ ok: boolean }>
  revert_ops: (pending_change_id: string) => Promise<{ ok: boolean }>
}

/**
 * Create MCP tools instance with proper implementations
 */
export function createMCPTools(
  userId: string,
  documentId?: string,
  onApplyOps?: (pending_change_id: string) => Promise<void>,
  onRevertOps?: (pending_change_id: string) => Promise<void>
): MCPTools {
  return {
    search_docs: (query: string, k: number = 10) => searchDocs(query, k, userId, documentId),
    pack_context: (ids: string[], budgetTokens: number = 1000) => packContext(ids, budgetTokens, userId, documentId),
    apply_ops: (pending_change_id: string) => applyOps(pending_change_id, onApplyOps),
    revert_ops: (pending_change_id: string) => revertOps(pending_change_id, onRevertOps)
  }
}

/**
 * Search documents using RAG system
 */
async function searchDocs(
  query: string, 
  k: number, 
  userId: string, 
  documentId?: string
): Promise<{ chunks: RagChunk[] }> {
  try {
    const searchResults = await ragAdapter.search(query, {
      topK: k,
      projectId: userId
    })

    return { chunks: searchResults }
  } catch (error) {
    console.error('search_docs error:', error)
    return { chunks: [] }
  }
}

/**
 * Pack context from specific chunk IDs
 */
async function packContext(
  ids: string[], 
  budgetTokens: number, 
  userId: string, 
  documentId?: string
): Promise<{ chunks: RagChunk[] }> {
  try {
    // Get chunks by IDs and pack them within token budget
    const chunks = await ragAdapter.packContext(
      ids.map(id => ({ id, docId: documentId || 'unknown' } as RagChunk)),
      budgetTokens
    )

    return { chunks }
  } catch (error) {
    console.error('pack_context error:', error)
    return { chunks: [] }
  }
}

/**
 * Apply preview operations
 */
async function applyOps(
  pending_change_id: string,
  onApplyOps?: (pending_change_id: string) => Promise<void>
): Promise<{ ok: boolean }> {
  try {
    if (onApplyOps) {
      await onApplyOps(pending_change_id)
    }
    console.log('Applied ops for change:', pending_change_id)
    return { ok: true }
  } catch (error) {
    console.error('apply_ops error:', error)
    return { ok: false }
  }
}

/**
 * Revert preview operations
 */
async function revertOps(
  pending_change_id: string,
  onRevertOps?: (pending_change_id: string) => Promise<void>
): Promise<{ ok: boolean }> {
  try {
    if (onRevertOps) {
      await onRevertOps(pending_change_id)
    }
    console.log('Reverted ops for change:', pending_change_id)
    return { ok: true }
  } catch (error) {
    console.error('revert_ops error:', error)
    return { ok: false }
  }
}

/**
 * Optional: Plan edit tool for model self-planning
 */
export interface PlanEditTool {
  plan_edit: (task: string, ask: string, selection: string, context_refs: any[]) => Promise<any>
}

/**
 * Create plan edit tool
 */
export function createPlanEditTool(): PlanEditTool {
  return {
    plan_edit: async (task: string, ask: string, selection: string, context_refs: any[]) => {
      // This would integrate with your planning system
      return {
        task,
        inputs: { target_text: selection || ask },
        context_refs,
        constraints: { tone: 'friendly' },
        telemetry: { route_conf: 0.5, rag_conf: 0.5 }
      }
    }
  }
}
