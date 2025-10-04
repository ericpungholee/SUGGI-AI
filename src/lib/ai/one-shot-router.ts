import { routerService } from './router-service'
import { RouterContext } from './intent-schema'

export type Intent = 'chat_general' | 'chat_web' | 'chat_rag' | 'editor_write'

export type EditorWriteGrounding = {
  use_docs: boolean
  use_web: boolean
  docs?: string[]
}

export type RouterResult = {
  intent: Intent
  confidence: number
  grounding?: EditorWriteGrounding
}

// Placeholder learned heads. In a full implementation these should be learned scores on embeddings
async function recencyHead(_msg: string): Promise<number> {
  // Heuristic: look for temporal cues as a lightweight stand-in
  const t = _msg.toLowerCase()
  const hits = ['today', 'latest', 'recent', 'now', 'news', 'current', 'this week', 'this month']
  return hits.some((h) => t.includes(h)) ? 0.8 : 0.2
}

async function generationHead(msg: string): Promise<number> {
  const t = msg.toLowerCase()
  const cues = ['write', 'draft', 'compose', 'create', 'report', 'summary', 'analysis', 'document']
  return cues.some((c) => t.includes(c)) ? 0.85 : 0.3
}

async function docProximity(msg: string, selectedDocs: string[]): Promise<number> {
  // If user has explicitly selected docs, treat proximity as high
  if (selectedDocs && selectedDocs.length > 0) return 0.8
  // Lightweight heuristic based on references like "my notes", "the doc", etc.
  const t = msg.toLowerCase()
  const cues = ['my notes', 'my doc', 'that doc', 'the document', 'our doc', 'saved notes']
  return cues.some((c) => t.includes(c)) ? 0.7 : 0.3
}

export async function routeIntent(
  msg: string,
  ctx: { selectedDocs: string[]; docIndexReady: boolean }
): Promise<RouterResult> {
  const [needsWeb, wantsLongform, proximity] = await Promise.all([
    recencyHead(msg),
    generationHead(msg),
    ctx.docIndexReady ? docProximity(msg, ctx.selectedDocs) : Promise.resolve(0),
  ])

  if (wantsLongform > 0.6) {
    const use_docs = proximity > 0.55 || ctx.selectedDocs.length > 0
    const use_web = needsWeb > 0.6
    return {
      intent: 'editor_write',
      confidence: 0.8,
      grounding: { use_docs, use_web, docs: ctx.selectedDocs },
    }
  }

  if (proximity > 0.55) return { intent: 'chat_rag', confidence: 0.75 }
  if (needsWeb > 0.6) return { intent: 'chat_web', confidence: 0.75 }
  return { intent: 'chat_general', confidence: 0.7 }
}

export async function getRouterContextLike(
  query: string,
  baseCtx: RouterContext
): Promise<RouterResult> {
  // Bridge helper to compute a compact intent alongside the existing router if needed later
  const selectedDocs = baseCtx.doc_ids || []
  return routeIntent(query, { selectedDocs, docIndexReady: true })
}


