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
  max_completion_tokens?: number
  stream?: boolean
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
  try {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      max_completion_tokens = 2000,
      stream = false
    } = options

    // Build request parameters
    const requestParams: any = {
      model,
      messages,
      max_completion_tokens,
      stream
    }

    // Only add temperature if the model supports it
    // Some models like gpt-4o-mini support temperature, others don't
    if (model.includes('gpt-4') || model.includes('gpt-3.5')) {
      requestParams.temperature = temperature
    }

    const response = await openai.chat.completions.create(requestParams)

    return response
  } catch (error) {
    console.error('OpenAI chat completion error:', error)
    throw new Error('Failed to generate AI response')
  }
}

/**
 * Generate text embeddings using OpenAI
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
) {
  try {
    const { model = 'text-embedding-3-small', dimensions = 1536 } = options

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
    const { model = 'text-embedding-3-small', dimensions = 1536 } = options

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
