import OpenAI from 'openai'

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    openai = new OpenAI({
      apiKey,
    })
  }
  return openai
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
  abortSignal?: AbortSignal
  useWebSearch?: boolean
  tools?: Array<{ type: string; [key: string]: any }>
  tool_choice?: 'auto' | { type: string }
}

export interface EmbeddingOptions {
  model?: string
  dimensions?: number
}

/**
 * Generate chat completion using OpenAI
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const {
    model = process.env.OPENAI_CHAT_MODEL || 'gpt-5-2025-08-07',
    temperature = 0.7,
    max_tokens = 2000,
    stream = false,
    abortSignal,
    useWebSearch = false,
    tools = [],
    tool_choice = 'auto'
  } = options

  try {
    // Check if operation was cancelled
    if (abortSignal?.aborted) {
      throw new Error('Operation was cancelled')
    }

    // Build request parameters
    const requestParams: any = {
      model,
      messages,
      stream
    }

    // Web search is handled in the GPT-5 Responses API section below

    // Use the correct parameter name based on model
    if (model.includes('gpt-5') || model.includes('gpt-4o')) {
      requestParams.max_completion_tokens = max_tokens
    } else {
      requestParams.max_tokens = max_tokens
    }

    // Only add temperature if the model supports it
    // Most models support temperature, but some experimental ones might not
    if (!model.includes('embedding') && !model.includes('davinci') && !model.includes('curie')) {
      requestParams.temperature = temperature
    }

    // Use Responses API for newer models that require it
    if (model.includes('gpt-5')) {
      try {
        // Convert messages to the format expected by Responses API
        const input = messages.map(m => ({
          role: m.role,
          content: m.content
        }))

        // GPT-5 has 400k context window and up to 128k output tokens
        // Reserve headroom for web search results (~6-8k tokens)
        const gpt5MaxTokens = Math.max(max_tokens, 12000)

        const responsesPayload: any = {
          model,
          input,
          max_output_tokens: gpt5MaxTokens
        }

        // Enable GPT-5's native web search and other tools
        if (useWebSearch || tools.length > 0) {
          const toolsList = [...tools]
          if (useWebSearch) {
            toolsList.push({ type: "web_search" })
          }
          responsesPayload.tools = toolsList
          responsesPayload.tool_choice = tool_choice
        }

        // GPT-5 Responses API may not support temperature; omit to avoid 400
        let resp = await getOpenAI().responses.create(
          responsesPayload,
          { signal: abortSignal }
        )
        
        // Poll for completion if response is incomplete (with faster polling)
        let attempts = 0
        const maxAttempts = 2 // Even fewer attempts
        while (resp.status === 'incomplete' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100)) // Much faster polling
          
          try {
            resp = await getOpenAI().responses.retrieve(resp.id, {}, { signal: abortSignal })
          } catch (pollError) {
            console.warn('Error polling for completion:', pollError)
            break
          }
          attempts++
        }
        
        if (resp.status === 'incomplete') {
          throw new Error('GPT-5 response incomplete, falling back')
        }

      // Normalize to Chat Completions-like shape for downstream code
      // Prefer output_text; fallback to nested output structure if present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = resp
      
      // Check if response is incomplete
      if (r.status === 'incomplete') {
        // If incomplete due to max tokens, try to get partial content
        if (r.incomplete_details?.reason === 'max_output_tokens') {
          // Response truncated due to max_output_tokens, using available content
        }
      }
      
      const nestedText = Array.isArray(r.output) && r.output.length > 0
        ? (Array.isArray(r.output[0]?.content) && r.output[0].content.find((c: any) => c.type === 'output_text')?.text) || r.output[0]?.content?.[0]?.text
        : undefined
      const contentText = r.output_text || nestedText || r.choices?.[0]?.message?.content || ''
      
        // If no content and response is incomplete, fall back to Chat Completions API
        if (!contentText && r.status === 'incomplete') {
          throw new Error('GPT-5 response incomplete, falling back')
        }

        const normalized = {
          choices: [
            {
              message: {
                content: contentText
              }
            }
          ],
          usage: r.usage
            ? {
                prompt_tokens: r.usage.input_tokens,
                completion_tokens: r.usage.output_tokens,
                total_tokens: r.usage.total_tokens
              }
            : undefined
        }

        return normalized as any
      } catch (gpt5Error) {
        // GPT-5 failed, falling back to Chat Completions API
        
        // Fall back to regular Chat Completions API with web search tools if needed
        const fallbackParams: any = {
          model: 'gpt-4o-mini', // Use a reliable fallback model
          messages: messages,
          max_tokens: 2000,
          temperature: 0.7
        }

        // Note: web_search tool is only available in GPT-5 Responses API, not Chat Completions
        // The fallback will use general knowledge without web search

        const fallbackResponse = await getOpenAI().chat.completions.create(fallbackParams, { signal: abortSignal })
        
        return fallbackResponse
      }
    }

    // Note: web_search tool is only available in GPT-5 Responses API, not Chat Completions
    // For other models, web search is handled at the application level

    // Fallback to Chat Completions API
    const response = await getOpenAI().chat.completions.create(requestParams, {
      signal: abortSignal
    })

    return response
  } catch (error) {
    if (abortSignal?.aborted) {
      throw new Error('Operation was cancelled')
    }
    // Try to surface underlying API error details when available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = error
    console.error('OpenAI chat completion error details:', {
      model,
      error: err?.message || error,
      status: err?.status,
      response: err?.response?.data,
      type: err?.type,
      fullError: err
    })
    
    // If we have a specific error message, include it
    const errorMessage = err?.message || err?.error?.message || 'Unknown error'
    throw new Error(`Failed to generate AI response: ${errorMessage}`)
  }
}

/**
 * Generate text embeddings using OpenAI with best model
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
) {
  try {
    // Use the best available embedding model
    const { model = (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small') } = options

    const response = await getOpenAI().embeddings.create({
      model,
      input: text
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('OpenAI embedding error:', error)
    throw new Error('Failed to generate embedding')
  }
}

/**
 * Generate multiple embeddings in batch
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
) {
  try {
    const { model = (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small') } = options

    const response = await getOpenAI().embeddings.create({
      model,
      input: texts
    })

    return response.data.map(item => item.embedding)
  } catch (error) {
    console.error('OpenAI batch embedding error:', error)
    throw new Error('Failed to generate embeddings')
  }
}

export default getOpenAI
