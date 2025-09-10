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
    model = 'gpt-4o-mini',
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
      max_tokens,
      stream
    }

    // Only add temperature if the model supports it
    // Some models like gpt-4o-mini support temperature, others don't
    if (model.includes('gpt-4') || model.includes('gpt-3.5')) {
      requestParams.temperature = temperature
    }

    // Create the request with abort signal support
    const response = await openai.chat.completions.create(requestParams, {
      signal: abortSignal
    })

    return response
  } catch (error) {
    if (abortSignal?.aborted) {
      throw new Error('Operation was cancelled')
    }
    console.error('OpenAI chat completion error:', error)
    throw new Error('Failed to generate AI response')
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
    const { model = 'text-embedding-3-large', dimensions = 3072 } = options

    const response = await openai.embeddings.create({
      model,
      input: text,
      dimensions
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
    const { model = 'text-embedding-3-large', dimensions = 3072 } = options

    const response = await openai.embeddings.create({
      model,
      input: texts,
      dimensions
    })

    return response.data.map(item => item.embedding)
  } catch (error) {
    console.error('OpenAI batch embedding error:', error)
    throw new Error('Failed to generate embeddings')
  }
}

export default openai
