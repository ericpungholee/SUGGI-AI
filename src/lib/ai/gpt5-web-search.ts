/**
 * GPT-5 Native Web Search Implementation
 * Uses OpenAI's Responses API with built-in web_search tool
 */

import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
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
  max_attempts?: number
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
    timeout_seconds = 20,
    max_attempts = 2
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
      timeout_seconds,
      max_attempts
    })

    // Use OpenAI SDK's built-in timeout instead of custom Promise.race
    const response = await openai.responses.create({
      model,
      input,
      tools: [{ type: "web_search" }],
      max_output_tokens: max_tokens
    }, {
      timeout: timeout_seconds * 1000 // Convert to milliseconds
    })

    // Log initial response for debugging
    console.log('📋 Initial Response:', {
      id: response.id,
      status: response.status,
      hasOutputText: !!response.output_text,
      outputTextLength: response.output_text?.length || 0,
      hasOutput: !!response.output,
      outputLength: response.output?.length || 0
    })

    // Wait for completion if needed - use more efficient polling like the main openai.ts
    let finalResponse = response
    
    if (response.status === 'incomplete') {
      let attempts = 0
      const maxPollingAttempts = Math.min(10, max_attempts) // Cap at 10 attempts for efficiency
      const pollInterval = 2000 // 2 second intervals
      
      console.log('⏳ Waiting for web search completion...')
      
      while (finalResponse.status === 'incomplete' && attempts < maxPollingAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
        try {
          finalResponse = await openai.responses.retrieve(response.id)
          attempts++
          
          console.log(`🔄 Polling attempt ${attempts}/${maxPollingAttempts}, status: ${finalResponse.status}`)
          
          // If we get an error status, break early
          if (finalResponse.status === 'error') {
            throw new Error(`Web search failed with error status: ${finalResponse.error?.message || 'Unknown error'}`)
          }
          
          // If we have output text, we can consider it done even if status is incomplete
          if (finalResponse.output_text && finalResponse.output_text.trim().length > 0) {
            console.log('✅ Found output text, considering search complete')
            break
          }
        } catch (pollError) {
          console.error('❌ Error during polling:', pollError)
          // Continue polling unless it's a critical error
          if (attempts < maxPollingAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, pollInterval))
            attempts++
            continue
          } else {
            throw pollError
          }
        }
      }
    }

    // Check if we have a usable response even if status isn't 'complete'
    const hasOutputText = finalResponse.output_text && finalResponse.output_text.trim().length > 0
    const hasOutput = finalResponse.output && finalResponse.output.length > 0
    
    if (finalResponse.status === 'error') {
      throw new Error(`Web search failed: ${finalResponse.error?.message || 'Unknown error'}`)
    }
    
    // If we have output text or output content, consider it successful even if status isn't 'complete'
    if (!hasOutputText && !hasOutput) {
      const errorMsg = `Web search incomplete after ${max_attempts} attempts (${max_attempts * pollInterval / 1000}s timeout). Status: ${finalResponse.status}`
      throw new Error(errorMsg)
    }
    
    // Log the actual status for debugging
    console.log('📊 Web Search Status:', {
      status: finalResponse.status,
      hasOutputText: !!hasOutputText,
      hasOutput: !!hasOutput,
      outputTextLength: finalResponse.output_text?.length || 0,
      outputLength: finalResponse.output?.length || 0
    })

    // Extract text content - try multiple sources
    let text = finalResponse.output_text || ''
    
    // If no output_text, try to extract from output structure
    if (!text && finalResponse.output) {
      for (const item of finalResponse.output) {
        if (item.type === 'message' && item.content) {
          for (const part of item.content) {
            if (typeof part === 'string') {
              text += part
            } else if (part && typeof part === 'object' && part.text) {
              text += part.text
            }
          }
        }
      }
    }

    // Extract citations from annotations
    const citations: Array<{ title?: string; url: string; domain?: string }> = []
    
    if (finalResponse.output) {
      for (const item of finalResponse.output) {
        if (item.type === 'message' && item.content) {
          for (const part of item.content) {
            const annotations = (part as any).annotations || []
            for (const annotation of annotations) {
              if (annotation.type === 'url_citation' && annotation.url) {
                try {
                  const domain = new URL(annotation.url).hostname
                  citations.push({
                    title: annotation.title,
                    url: annotation.url,
                    domain
                  })
                } catch (urlError) {
                  // If URL parsing fails, still add the citation
                  citations.push({
                    title: annotation.title,
                    url: annotation.url
                  })
                }
              }
            }
          }
        }
      }
    }

    console.log('✅ GPT-5 Web Search Complete:', {
      textLength: text.length,
      citationsCount: citations.length,
      usage: finalResponse.usage
    })

    return {
      text,
      citations,
      usage: finalResponse.usage
    }

  } catch (error) {
    console.error('❌ GPT-5 Web Search Error:', error)
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Stream web search results for real-time UI updates
 */
export async function streamWebSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<ReadableStream> {
  const {
    model = 'gpt-5-2025-08-07',
    max_tokens = 4000,
    force_web_search = false,
    timeout_seconds = 60,
    max_attempts = 30
  } = options

  try {
    let input = query
    if (force_web_search) {
      input = `Use web search to find current, accurate information about: ${query}. Provide 2-4 reputable sources with links.`
    }

    console.log('🌊 Streaming GPT-5 Web Search:', {
      query,
      model,
      force_web_search
    })

    // Create streaming response
    const stream = await openai.responses.stream({
      model,
      input,
      tools: [{ type: "web_search" }],
      max_output_tokens: max_tokens
      // Note: temperature is not supported by GPT-5 Responses API
    })

    return stream.toReadableStream()

  } catch (error) {
    console.error('❌ GPT-5 Web Search Stream Error:', error)
    throw new Error(`Web search streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if a query should use web search based on intent classification
 */
export function shouldUseWebSearch(intent: string, confidence: number): boolean {
  // Use web search for web_search intent or ask intent with high recency needs
  return intent === 'web_search' || (intent === 'ask' && confidence > 0.8)
}

/**
 * Format citations for display
 */
export function formatCitations(citations: Array<{ title?: string; url: string; domain?: string }>): string {
  if (citations.length === 0) return ''

  const sources = citations.map((citation, index) => {
    const title = citation.title || citation.domain || 'Source'
    return `${index + 1}. [${title}](${citation.url})`
  }).join('\n')

  return `\n\n**Sources:**\n${sources}`
}
