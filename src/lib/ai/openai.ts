import { getOpenAI } from './core/openai-client'
import { getChatModel } from './core/models'

// Re-export types from core
export type { ChatMessage, ChatCompletionOptions, EmbeddingOptions } from './core/types'

/**
 * Generate chat completion using OpenAI
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
) {
  const {
    model = process.env.OPENAI_CHAT_MODEL || getChatModel(),
    temperature = 0.7,
    max_tokens = 2000,
    stream = false,
    abortSignal,
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

    // Add tools if specified
    if (tools.length > 0) {
      requestParams.tools = tools
      requestParams.tool_choice = tool_choice
    }

    // Use the correct parameter name based on model
    if (model.includes('gpt-4o') || model.includes('gpt-5')) {
      requestParams.max_completion_tokens = max_tokens
    } else {
      requestParams.max_tokens = max_tokens
    }

    // Add temperature for supported models (GPT-5 only supports default temperature)
    if (!model.includes('embedding') && !model.includes('davinci') && !model.includes('curie') && !model.includes('gpt-5')) {
      requestParams.temperature = temperature
    }

    // Note: web search is handled at the application level using the web search service

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
    const { model = (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large') } = options

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
    const { model = (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large') } = options

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
