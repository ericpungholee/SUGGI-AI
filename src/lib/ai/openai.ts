import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    temperature = 0.7,
    max_tokens = 2000,
    stream = false,
    abortSignal
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
      // Combine messages into a single input string preserving roles
      const combinedInput = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n')

      const responsesPayload: any = {
        model,
        input: combinedInput,
        max_output_tokens: max_tokens,
        stream: stream ? true : false
      }

      // GPT-5 Responses API may not support temperature; omit to avoid 400
      const resp = await openai.responses.create(
        responsesPayload,
        { signal: abortSignal }
      )

      // Normalize to Chat Completions-like shape for downstream code
      // Prefer output_text; fallback to nested output structure if present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = resp
      const nestedText = Array.isArray(r.output) && r.output.length > 0
        ? (Array.isArray(r.output[0]?.content) && r.output[0].content.find((c: any) => c.type === 'output_text')?.text) || r.output[0]?.content?.[0]?.text
        : undefined
      const contentText = r.output_text || nestedText || r.choices?.[0]?.message?.content || ''

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
    }

    // Fallback to Chat Completions API
    const response = await openai.chat.completions.create(requestParams, {
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

    const response = await openai.embeddings.create({
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

    const response = await openai.embeddings.create({
      model,
      input: texts
    })

    return response.data.map(item => item.embedding)
  } catch (error) {
    console.error('OpenAI batch embedding error:', error)
    throw new Error('Failed to generate embeddings')
  }
}

export default openai
