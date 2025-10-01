import { generateChatCompletion } from './openai'
import { RagChunk } from './rag-adapter'

export interface ContextRef {
  type: 'doc' | 'web'
  id: string
  anchor?: string
  why: string
  score?: number
  content?: string
}

export interface InstructionJSON {
  task: string
  inputs: Record<string, any>
  context_refs: ContextRef[]
  policies: {
    cite_every_claim: boolean
    no_external_sources: boolean
    max_tokens?: number
    format?: string
  }
  telemetry: {
    route_conf: number
    rag_conf: number
    coverage: number
    total_tokens: number
  }
}

/**
 * Fill instruction JSON based on router result and evidence
 */
export async function fillInstructionJSON(
  routerResult: any,
  ask: string,
  selection?: string,
  ragChunks: RagChunk[] = [],
  webResults: any[] = [],
  ragConf: number = 0,
  coverage: number = 0
): Promise<InstructionJSON> {
  try {
    const contextRefs: ContextRef[] = []
    
    // Add RAG chunk references
    ragChunks.forEach((chunk, index) => {
      contextRefs.push({
        type: 'doc',
        id: chunk.id,
        anchor: chunk.anchor,
        why: getChunkReason(chunk, routerResult.classification.intent),
        score: chunk.score
      })
    })

    // Add web result references with actual content
    webResults.forEach((result, index) => {
      contextRefs.push({
        type: 'web',
        id: result.url || `web-${index}`,
        why: getWebReason(result, routerResult.classification.intent),
        score: result.score || 0.8,
        content: result.snippet || result.title || 'Web search result'
      })
    })

    // Determine task-specific inputs
    const inputs = getTaskInputs(routerResult, ask, selection)

    // Determine policies based on task and evidence quality
    const policies = getTaskPolicies(routerResult, ragConf, coverage)

    // Calculate telemetry
    const totalTokens = ragChunks.reduce((sum, chunk) => sum + chunk.tokens, 0) +
                       webResults.reduce((sum, result) => sum + (result.tokens || 100), 0)

    return {
      task: routerResult.classification.intent,
      inputs,
      context_refs: contextRefs,
      policies: {
        cite_every_claim: routerResult.classification.slots.outputs === 'answer',
        no_external_sources: routerResult.classification.intent === 'rag_query',
        max_tokens: 2000,
        format: 'markdown'
      },
      telemetry: {
        route_conf: 0.8, // Default confidence for routing
        rag_conf: ragConf,
        coverage,
        total_tokens: totalTokens
      }
    }
  } catch (error) {
    console.error('Error filling instruction JSON:', error)
    throw new Error(`Failed to create instruction JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get reason for why a chunk is relevant
 */
function getChunkReason(chunk: RagChunk, task: string): string {
  const reasons = {
    rewrite: 'content for editing',
    summarize: 'source material',
    extend: 'context for expansion',
    fact_check: 'factual information',
    table: 'structured data',
    refs: 'reference material',
    general: 'relevant information'
  }
  
  return reasons[task] || 'relevant information'
}

/**
 * Get reason for why a web result is relevant
 */
function getWebReason(result: any, task: string): string {
  const reasons = {
    rewrite: 'current style guide',
    summarize: 'additional context',
    extend: 'supplementary information',
    fact_check: 'independent verification',
    table: 'data sources',
    refs: 'external references',
    general: 'current information'
  }
  
  return reasons[task] || 'current information'
}

/**
 * Get task-specific inputs
 */
function getTaskInputs(routerResult: any, ask: string, selection?: string): Record<string, any> {
  const baseInputs = {
    query: ask,
    style: 'medium',
    precision: 'medium'
  }

  switch (routerResult.classification.intent) {
    case 'rewrite':
      return {
        ...baseInputs,
        original_text: selection || '',
        style: 'medium',
        preserve_meaning: true
      }
    
    case 'summarize':
      return {
        ...baseInputs,
        max_words: 200,
        style: 'bullets',
        include_key_points: true
      }
    
    case 'extend':
      return {
        ...baseInputs,
        current_content: selection || '',
        extension_type: 'natural',
        maintain_style: true
      }
    
    case 'fact_check':
      return {
        ...baseInputs,
        claims_to_verify: ask,
        require_sources: true,
        confidence_threshold: 0.8
      }
    
    case 'table':
      return {
        ...baseInputs,
        table_type: 'data',
        include_headers: true,
        format: 'markdown'
      }
    
    case 'refs':
      return {
        ...baseInputs,
        reference_type: 'academic',
        include_urls: true,
        format: 'detailed'
      }
    
    default:
      return baseInputs
  }
}

/**
 * Get task-specific policies
 */
function getTaskPolicies(routerResult: any, ragConf: number, coverage: number): InstructionJSON['policies'] {
  return {
    cite_every_claim: routerResult.classification.slots.outputs === 'answer',
    no_external_sources: routerResult.classification.intent === 'rag_query',
    max_tokens: 2000,
    format: 'markdown'
  }
}

/**
 * Validate instruction JSON
 */
export function validateInstructionJSON(instruction: any): instruction is InstructionJSON {
  return (
    typeof instruction === 'object' &&
    instruction !== null &&
    typeof instruction.task === 'string' &&
    typeof instruction.inputs === 'object' &&
    Array.isArray(instruction.context_refs) &&
    typeof instruction.policies === 'object' &&
    typeof instruction.telemetry === 'object' &&
    typeof instruction.telemetry.route_conf === 'number' &&
    typeof instruction.telemetry.rag_conf === 'number' &&
    typeof instruction.telemetry.coverage === 'number' &&
    typeof instruction.telemetry.total_tokens === 'number'
  )
}

/**
 * Generate system prompt from instruction JSON
 */
export function generateSystemPrompt(instruction: InstructionJSON): string {
  const { task, inputs, context_refs, policies } = instruction
  
  let prompt = `You are an AI assistant helping with a ${task} task. 

TASK: ${task.toUpperCase()}
INPUTS: ${JSON.stringify(inputs, null, 2)}

POLICIES:
- Cite every claim: ${policies.cite_every_claim ? 'YES' : 'NO'}
- No external sources: ${policies.no_external_sources ? 'YES' : 'NO'}
- Max tokens: ${policies.max_tokens || 'unlimited'}
- Format: ${policies.format || 'text'}

AVAILABLE SOURCES AND DATA:
`

  // Add context references with actual content
  context_refs.forEach((ref, index) => {
    prompt += `${index + 1}. [${ref.type.toUpperCase()}] ${ref.id} - ${ref.why}${ref.score ? ` (score: ${ref.score.toFixed(2)})` : ''}\n`
    
    // Include actual content for web sources
    if (ref.type === 'web' && ref.content) {
      prompt += `   CONTENT: ${ref.content}\n`
    }
  })

  prompt += `
INSTRUCTIONS:
1. Use ONLY the sources and data listed above
2. ${policies.cite_every_claim ? 'Cite every claim with [1], [2], etc.' : 'Include citations when helpful'}
3. ${policies.no_external_sources ? 'Do not reference any external sources not listed above' : 'You may reference web sources if they are in the context'}
4. Maintain the specified format: ${policies.format || 'text'}
5. Stay within token limits: ${policies.max_tokens || 'unlimited'}
6. For web data, use the actual content provided above, not just the titles

WRITING TO EDITOR:
- When asked to write reports, create content, or generate documents, ALWAYS start your response with phrases like "I'll write:", "I'm writing:", "Let me write:", "Here's the report:", "I'll create:", "I'm creating:", "I'll provide:", "I'm providing:", "Here's a", "Here is a", "I'll draft:", or "I'm drafting:"
- Include the actual content to be written after your introductory phrase
- Don't ask for confirmation - just start writing immediately
- Format content properly with markdown when appropriate

Respond with high-quality content that fulfills the ${task} task using the available sources.`

  return prompt
}

/**
 * Repair instruction JSON if it's malformed
 */
export function repairInstructionJSON(instruction: any): InstructionJSON {
  try {
    // Basic repair - ensure all required fields exist
    return {
      task: instruction.task || 'general',
      inputs: instruction.inputs || {},
      context_refs: Array.isArray(instruction.context_refs) ? instruction.context_refs : [],
      policies: {
        cite_every_claim: instruction.policies?.cite_every_claim || false,
        no_external_sources: instruction.policies?.no_external_sources || false,
        max_tokens: instruction.policies?.max_tokens,
        format: instruction.policies?.format || 'text'
      },
      telemetry: {
        route_conf: instruction.telemetry?.route_conf || 0.5,
        rag_conf: instruction.telemetry?.rag_conf || 0.5,
        coverage: instruction.telemetry?.coverage || 0.5,
        total_tokens: instruction.telemetry?.total_tokens || 0
      }
    }
  } catch (error) {
    console.error('Error repairing instruction JSON:', error)
    // Return minimal valid instruction
    return {
      task: 'general',
      inputs: {},
      context_refs: [],
      policies: {
        cite_every_claim: false,
        no_external_sources: false
      },
      telemetry: {
        route_conf: 0.5,
        rag_conf: 0.5,
        coverage: 0.5,
        total_tokens: 0
      }
    }
  }
}
