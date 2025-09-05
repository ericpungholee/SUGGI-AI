import { generateEmbedding, generateEmbeddings } from './openai'

export interface DocumentChunk {
  id: string
  content: string
  embedding: number[]
  chunkIndex: number
}

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

/**
 * Chunk text into smaller pieces for better embedding processing
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    let chunk = text.slice(start, end)

    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastSentenceEnd = chunk.lastIndexOf('.')
      const lastParagraphEnd = chunk.lastIndexOf('\n\n')
      const breakPoint = Math.max(lastSentenceEnd, lastParagraphEnd)
      
      if (breakPoint > start + chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1)
      }
    }

    chunks.push(chunk.trim())
    start = start + chunk.length - overlap
  }

  return chunks.filter(chunk => chunk.length > 0)
}

/**
 * Generate embedding for a single text
 */
export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const embedding = await generateEmbedding(text)
    
    // Rough token count estimation (1 token ≈ 4 characters)
    const tokenCount = Math.ceil(text.length / 4)
    
    return {
      embedding,
      tokenCount
    }
  } catch (error) {
    console.error('Error creating embedding:', error)
    throw new Error('Failed to create embedding')
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function createEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  try {
    const embeddings = await generateEmbeddings(texts)
    
    return texts.map((text, index) => ({
      embedding: embeddings[index],
      tokenCount: Math.ceil(text.length / 4)
    }))
  } catch (error) {
    console.error('Error creating embeddings:', error)
    throw new Error('Failed to create embeddings')
  }
}

/**
 * Process document content into chunks with embeddings
 */
export async function processDocumentContent(
  content: string,
  documentId: string
): Promise<DocumentChunk[]> {
  try {
    // Clean and prepare text
    const cleanText = content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    if (!cleanText) {
      return []
    }

    // Chunk the text
    const textChunks = chunkText(cleanText)
    
    // Generate embeddings for all chunks
    const embeddingResults = await createEmbeddings(textChunks)
    
    // Create document chunks
    const documentChunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
      id: `${documentId}-chunk-${index}`,
      content: chunk,
      embedding: embeddingResults[index].embedding,
      chunkIndex: index
    }))

    return documentChunks
  } catch (error) {
    console.error('Error processing document content:', error)
    throw new Error('Failed to process document content')
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Find most similar chunks based on embedding similarity
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  limit: number = 5,
  threshold: number = 0.7
): DocumentChunk[] {
  const similarities = chunks.map(chunk => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
  }))

  return similarities
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => item.chunk)
}
