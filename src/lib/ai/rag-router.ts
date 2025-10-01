import { generateChatCompletion } from './openai'

export interface RouterDecision {
  task: 'rewrite' | 'summarize' | 'extend' | 'fact_check' | 'table' | 'refs' | 'write' | 'general'
  needs: {
    web_context: 'no' | 'optional' | 'required'
    precision: 'low' | 'medium' | 'high'
    creativity: 'low' | 'medium' | 'high'
  }
  query: {
    semantic: string
    keywords: string[]
  }
  constraints: {
    max_tokens?: number
    citation_style?: 'minimal' | 'detailed'
    format?: 'text' | 'markdown' | 'html'
  }
}

/**
 * Route user query to determine task type and requirements
 */
export async function routeQuery(
  ask: string,
  selection?: string,
  session?: any
): Promise<RouterDecision> {
  try {
    const routingPrompt = `Analyze this user query and determine the task type and requirements. Respond with ONLY valid JSON, no other text.

User Query: "${ask}"
${selection ? `Selected Text: "${selection}"` : ''}

Task Types:
- write: Write new content, create documents, generate reports, compose articles
- rewrite: Rewrite, edit, or improve existing content
- summarize: Summarize, condense, or extract key points
- extend: Add content, expand, or continue writing
- fact_check: Verify facts, check accuracy, or validate claims
- table: Create, edit, or modify tables
- refs: Find references, citations, or sources
- general: General question or conversation

Requirements:
- web_context: "no" (RAG only), "optional" (RAG preferred), "required" (web needed)
- precision: "low" (creative/interpretive), "medium" (balanced), "high" (factual/technical)
- creativity: "low" (strict/factual), "medium" (balanced), "high" (creative/interpretive)

Constraints:
- max_tokens: Estimated token limit needed
- citation_style: "minimal" or "detailed"
- format: "text", "markdown", or "html"

Respond with this exact JSON format:
{
  "task": "write",
  "needs": {
    "web_context": "required",
    "precision": "high",
    "creativity": "medium"
  },
  "query": {
    "semantic": "processed query for RAG search",
    "keywords": ["key", "terms"]
  },
  "constraints": {
    "max_tokens": 2000,
    "citation_style": "minimal",
    "format": "markdown"
  }
}`

    const response = await generateChatCompletion([
      { role: 'user', content: routingPrompt }
    ], {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 500
    })

    const result = response.choices[0]?.message?.content?.trim()
    if (!result) {
      throw new Error('No routing response received')
    }

    // Try to parse JSON response
    let parsed: RouterDecision
    try {
      // Extract JSON from response if it's wrapped in other text
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : result
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Error parsing routing response:', parseError)
      console.error('Raw response:', result)
      
      // Fallback to default routing
      parsed = createFallbackRoute(ask, selection)
    }

    // Validate and normalize the response
    return validateAndNormalizeRoute(parsed, ask)
  } catch (error) {
    console.error('Error in query routing:', error)
    return createFallbackRoute(ask, selection)
  }
}

/**
 * Create fallback route when routing fails
 */
function createFallbackRoute(ask: string, selection?: string): RouterDecision {
  const lowerAsk = ask.toLowerCase()
  
  // Simple heuristics for task detection
  let task: RouterDecision['task'] = 'general'
  if (lowerAsk.includes('write') || lowerAsk.includes('create') || lowerAsk.includes('generate') || lowerAsk.includes('compose') || lowerAsk.includes('draft') || lowerAsk.includes('report')) {
    task = 'write'
  } else if (lowerAsk.includes('rewrite') || lowerAsk.includes('edit') || lowerAsk.includes('improve')) {
    task = 'rewrite'
  } else if (lowerAsk.includes('summarize') || lowerAsk.includes('summary')) {
    task = 'summarize'
  } else if (lowerAsk.includes('add') || lowerAsk.includes('extend') || lowerAsk.includes('continue')) {
    task = 'extend'
  } else if (lowerAsk.includes('fact') || lowerAsk.includes('verify') || lowerAsk.includes('check')) {
    task = 'fact_check'
  } else if (lowerAsk.includes('table')) {
    task = 'table'
  } else if (lowerAsk.includes('reference') || lowerAsk.includes('citation') || lowerAsk.includes('source')) {
    task = 'refs'
  }

  // Simple heuristics for web context needs
  let webContext: 'no' | 'optional' | 'required' = 'optional'
  if (lowerAsk.includes('current') || lowerAsk.includes('latest') || lowerAsk.includes('recent')) {
    webContext = 'required'
  } else if (lowerAsk.includes('news') || lowerAsk.includes('today') || lowerAsk.includes('2024')) {
    webContext = 'required'
  }

  // Simple heuristics for precision
  let precision: 'low' | 'medium' | 'high' = 'medium'
  if (lowerAsk.includes('creative') || lowerAsk.includes('imagine') || lowerAsk.includes('story')) {
    precision = 'low'
  } else if (lowerAsk.includes('fact') || lowerAsk.includes('data') || lowerAsk.includes('number')) {
    precision = 'high'
  }

  return {
    task,
    needs: {
      web_context: webContext,
      precision,
      creativity: precision === 'high' ? 'low' : precision === 'low' ? 'high' : 'medium'
    },
    query: {
      semantic: ask,
      keywords: extractKeywords(ask)
    },
    constraints: {
      max_tokens: 1000,
      citation_style: 'minimal',
      format: 'text'
    }
  }
}

/**
 * Validate and normalize route response
 */
function validateAndNormalizeRoute(route: any, originalAsk: string): RouterDecision {
  return {
    task: validateTask(route.task),
    needs: {
      web_context: validateWebContext(route.needs?.web_context),
      precision: validatePrecision(route.needs?.precision),
      creativity: validateCreativity(route.needs?.creativity)
    },
    query: {
      semantic: route.query?.semantic || originalAsk,
      keywords: Array.isArray(route.query?.keywords) ? route.query.keywords : extractKeywords(originalAsk)
    },
    constraints: {
      max_tokens: typeof route.constraints?.max_tokens === 'number' ? route.constraints.max_tokens : 1000,
      citation_style: route.constraints?.citation_style === 'detailed' ? 'detailed' : 'minimal',
      format: ['text', 'markdown', 'html'].includes(route.constraints?.format) ? route.constraints.format : 'text'
    }
  }
}

/**
 * Validate task type
 */
function validateTask(task: any): RouterDecision['task'] {
  const validTasks = ['rewrite', 'summarize', 'extend', 'fact_check', 'table', 'refs', 'general']
  return validTasks.includes(task) ? task : 'general'
}

/**
 * Validate web context requirement
 */
function validateWebContext(webContext: any): 'no' | 'optional' | 'required' {
  const validContexts = ['no', 'optional', 'required']
  return validContexts.includes(webContext) ? webContext : 'optional'
}

/**
 * Validate precision level
 */
function validatePrecision(precision: any): 'low' | 'medium' | 'high' {
  const validPrecisions = ['low', 'medium', 'high']
  return validPrecisions.includes(precision) ? precision : 'medium'
}

/**
 * Validate creativity level
 */
function validateCreativity(creativity: any): 'low' | 'medium' | 'high' {
  const validCreativities = ['low', 'medium', 'high']
  return validCreativities.includes(creativity) ? creativity : 'medium'
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words and extract meaningful terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'
  ])
  
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
    .slice(0, 10) // Limit to 10 keywords
}
