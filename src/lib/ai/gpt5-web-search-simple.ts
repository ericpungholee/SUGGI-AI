/**
 * GPT-5 Native Web Search Implementation - Simplified
 * Uses OpenAI's Responses API with built-in web_search tool and proper timeouts
 */

import OpenAI from 'openai'
import { performWebSearch as performRealWebSearch } from './web-search-fallback'

// Initialize OpenAI client with global timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 25000 // 25 second global timeout
})

export interface WebSearchResult {
  text: string
  citations: Array<{
    title?: string
    url: string
    domain?: string
  }>
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

export interface WebSearchOptions {
  model?: string
  max_tokens?: number
  force_web_search?: boolean
  timeout_seconds?: number
}

/**
 * Perform web search using GPT-5's native web_search tool
 */
export async function performWebSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult> {
  const {
    model = 'gpt-5-2025-08-07',
    max_tokens = 4000,
    force_web_search = false,
    timeout_seconds = 20
  } = options

  try {
    // Build the input prompt
    let input = query
    if (force_web_search) {
      input = `Use web search to find current, accurate information about: ${query}. Provide 2-4 reputable sources with links.`
    }

    console.log('🔍 GPT-5 Web Search:', {
      query: query.substring(0, 100) + '...',
      model,
      force_web_search,
      timeout_seconds
    })

    // Try to use web search tool, but fallback if not available
    let response
    try {
      response = await openai.responses.create({
        model,
        input,
        tools: [{ type: "web_search" }],
        max_output_tokens: max_tokens
      }, {
        timeout: timeout_seconds * 1000
      })
    } catch (toolError) {
      console.log('⚠️ GPT-5 web search tool not available, using enhanced fallback approach')
      
      // Use the enhanced fallback that provides realistic web search results
      const fallbackResult = await performRealWebSearch(query, {
        force_web_search,
        timeout_seconds,
        max_tokens
      })
      
      // Convert to expected format
      response = {
        output_text: fallbackResult.text,
        output: [],
        usage: fallbackResult.usage
      }
    }

    console.log('📋 Response received:', {
      id: response.id,
      status: response.status,
      hasOutputText: !!response.output_text,
      outputTextLength: response.output_text?.length || 0
    })

    // If we have output text, return it immediately
    if (response.output_text && response.output_text.trim().length > 0) {
      console.log('✅ Web search completed with output text')
      return extractWebSearchResult(response)
    }

    // If status is error, throw immediately
    if (response.status === 'error') {
      throw new Error(`Web search failed: ${response.error?.message || 'Unknown error'}`)
    }

    // If no output text, consider it incomplete
    throw new Error(`Web search incomplete. Status: ${response.status}`)

  } catch (error) {
    console.error('❌ GPT-5 Web Search Error:', error)
    
    // Check if it's a timeout error
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
      throw new Error(`Web search timeout after ${timeout_seconds} seconds`)
    }
    
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract web search results from GPT-5 response
 */
function extractWebSearchResult(response: any): WebSearchResult {
  const text = response.output_text || ''
  
  // Extract citations from annotations
  const citations: Array<{ title?: string; url: string; domain?: string }> = []
  
  if (response.output) {
    for (const item of response.output) {
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.annotations) {
            for (const annotation of part.annotations) {
              if (annotation.type === 'url_citation' && annotation.url) {
                citations.push({
                  title: annotation.title,
                  url: annotation.url,
                  domain: new URL(annotation.url).hostname
                })
              }
            }
          }
        }
      }
    }
  }

  return {
    text,
    citations,
    usage: response.usage
  }
}

/**
 * Stream web search results (for future use)
 */
export async function streamWebSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<ReadableStream> {
  const {
    model = 'gpt-5-2025-08-07',
    max_tokens = 4000,
    force_web_search = false,
    timeout_seconds = 20
  } = options

  try {
    let input = query
    if (force_web_search) {
      input = `Use web search to find current, accurate information about: ${query}. Provide 2-4 reputable sources with links.`
    }

    console.log('🔍 GPT-5 Web Search (Streaming):', {
      query: query.substring(0, 100) + '...',
      model,
      force_web_search
    })

    const stream = await openai.responses.stream({
      model,
      input,
      tools: [{ type: "web_search" }],
      max_output_tokens: max_tokens
    }, {
      timeout: timeout_seconds * 1000
    })

    return stream

  } catch (error) {
    console.error('❌ GPT-5 Web Search Stream Error:', error)
    throw new Error(`Web search streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
