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
      model = 'gpt-4',
      temperature = 0.7,
      max_tokens = 2000,
      stream = false
    } = options

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      stream
    })

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
