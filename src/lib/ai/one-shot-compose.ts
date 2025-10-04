import { getOpenAI } from './core/openai-client'
import { getChatModel, getWebSearchModel } from './core/models'
import { ragAdapter, RagChunk } from './rag-adapter'
import { vectorDB } from './vector-db'

type Source = { kind: 'web' | 'doc'; title: string; url?: string | null; docId?: string; section?: string }

export async function oneShotCompose(opts: {
  topic: string
  grounding: { use_docs: boolean; use_web: boolean; docs?: string[] }
  timeBudgetMs?: number
  editorDocId?: string
}) {
  const timeBudget = opts.timeBudgetMs ?? 35_000

  // 1) Outline quickly
  const openai = getOpenAI()
  const plan = await openai.responses.create(
    {
      model: getChatModel(),
      input:
        `Make a crisp outline to write about: "${opts.topic}".
- Target: non-technical reader
- 3–6 sections, with bullet goals per section.
- Output JSON: { "sections": [ { "title": "", "goals": ["", ""] } ] }`,
    },
    { timeout: timeBudget }
  )
  const outline = safeParseJSON(plan.output_text).sections ?? []

  // 2) Gather in parallel with enhanced GPT-5 October 2025 web search
  const ragPromise = opts.grounding.use_docs
    ? retrieveDocExcerpts(opts.topic, opts.grounding.docs ?? [], 8)
    : Promise.resolve<{ excerpts: { docId: string; section: string; text: string }[]; docSources: Source[] }>({
        excerpts: [],
        docSources: [],
      })

  const webPromise = opts.grounding.use_web
    ? (async () => {
        const { webSearch } = await import('./services/web-search')
        return webSearch({
          prompt: `Search for current, accurate information about "${opts.topic}" (October 2025 context). Return 8–12 short bullet facts aligned to this outline:
${JSON.stringify(outline).slice(0, 4000)}

Requirements for October 2025:
- Use real-time, up-to-date information
- Focus on recent developments and current data
- Each bullet ≤ 30 words with specific facts
- Add bracket citations like [^W1], [^W2], etc.
- Include a "Sources" list with URLs and publication dates at the end
- Prioritize authoritative sources and current information`,
          model: getWebSearchModel(),
          maxResults: 8,
          timeoutMs: Math.min(timeBudget, 15000) // Cap at 15 seconds
        })
      })()
    : Promise.resolve(null)

  const [rag, web] = await Promise.allSettled([ragPromise, webPromise])

  const docSources: Source[] = rag.status === 'fulfilled' ? rag.value.docSources : []
  const webText = web && web.status === 'fulfilled' ? (web.value as any).text : ''
  const webSources: Source[] = web && web.status === 'fulfilled' ? 
    (web.value as any).citations.map((c: any, i: number) => ({ 
      kind: 'web' as const, 
      title: c.title || `Web Source ${i + 1}`, 
      url: c.url 
    })) : 
    extractWebSourcesFromText(webText)

  // 3) Compose
  const sources: Source[] = [
    ...webSources.map((s, i) => ({ ...s, title: s.title || `Web Source ${i + 1}` })),
    ...docSources.map((s, i) => ({ ...s, title: s.title || `Internal Doc ${i + 1}` })),
  ]

  const writer = await openai.responses.create(
    {
      model: getChatModel(),
      input: `Write polished Markdown only for October 2025. Audience: informed generalist.
Use the outline and facts below. Cite with footnotes [^1], [^2] that refer to the provided Sources array order.
Do NOT invent URLs. Use only real, current data from October 2025.

OUTLINE:
${JSON.stringify(outline).slice(0, 4000)}

WEB_FACTS (Current as of October 2025):
${truncate(webText, 6000)}

DOC_EXCERPTS (quote and cite when used):
${formatExcerpts(rag.status === 'fulfilled' ? rag.value : null)}

SOURCES (ordered):
${formatSourcesForModel(sources)}

CRITICAL: Use ONLY real, current data from October 2025. Never use placeholder values. Include specific numbers, dates, and facts when available.`,
      max_output_tokens: 8000
    },
    { timeout: timeBudget }
  )

  const md = (writer as any).output_text || '# Draft\n\n(Empty)'

  // 4) Return draft payload; editor insertion handled at route level
  return { markdown: md, sources }
}

export async function retrieveDocExcerpts(
  topic: string,
  docIds: string[],
  k: number
): Promise<{ excerpts: { docId: string; section: string; text: string }[]; docSources: Source[] }> {
  // Use existing ragAdapter to fetch top-k chunks across selected documents
  const chunks = await ragAdapter.search(topic, { topK: Math.max(5, k), projectId: undefined })
  const filtered: RagChunk[] = docIds && docIds.length > 0 ? chunks.filter((c) => docIds.includes(c.docId)) : chunks
  const top = filtered.slice(0, k)
  const excerpts = top.map((c) => ({ docId: c.docId, section: c.anchor || 'n/a', text: c.text }))
  const docSources: Source[] = top.map((c) => ({ kind: 'doc', title: c.docId, docId: c.docId, section: c.anchor }))
  return { excerpts, docSources }
}

function safeParseJSON(s?: string) {
  try {
    return JSON.parse(s ?? '{}')
  } catch {
    return {}
  }
}

function truncate(s: string, n: number) {
  return (s ?? '').slice(0, n)
}

export function extractWebSourcesFromText(txt: string): Source[] {
  if (!txt) return []
  // Try to parse a Sources section lines starting with 'Sources' then list
  const sources: Source[] = []
  const lines = txt.split('\n')
  let inSources = false
  for (const line of lines) {
    if (/^\s*Sources\s*:?/i.test(line)) {
      inSources = true
      continue
    }
    if (inSources) {
      const m = line.match(/\d+\.?\s*(.+?)\s*-+\s*(https?:\/\/\S+)/i) || line.match(/\d+\.?\s*(.+?)\s*(https?:\/\/\S+)/i)
      if (m) {
        const title = m[1].trim()
        const url = m[2].trim()
        sources.push({ kind: 'web', title, url })
      }
    }
  }
  // Fallback: scan for bare URLs if no structured sources
  if (sources.length === 0) {
    const urlRegex = /(https?:\/\/[^\s)]+)\/??/gi
    const found = Array.from(txt.matchAll(urlRegex)).slice(0, 8)
    found.forEach((m, idx) => sources.push({ kind: 'web', title: `Web Source ${idx + 1}`, url: m[1] }))
  }
  return sources
}

function formatExcerpts(ragResult: any) {
  if (!ragResult || ragResult.excerpts?.length === 0) return '(none)'
  return ragResult.excerpts
    .map((e: any, i: number) => `- [D${i + 1}] (${e.docId} §${e.section}): ${e.text}`)
    .join('\n')
}

function formatSourcesForModel(sources: Source[]) {
  return sources
    .map((s, i) =>
      `${i + 1}. ${
        s.kind === 'web'
          ? (s.title ?? 'Web') + (s.url ? ' — ' + s.url : '')
          : `Internal: ${s.title} (${s.docId}${s.section ? ' §' + s.section : ''})`
      }`
    )
    .join('\n')
}


