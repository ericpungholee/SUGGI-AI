import { generateEmbedding, generateEmbeddings } from './openai'

export interface DocumentChunk {
  id: string
  documentId: string
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
  if (!text || text.length === 0) {
    return []
  }
  
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0
  let iterationCount = 0
  const maxIterations = Math.ceil(text.length / (chunkSize - overlap)) + 10 // Safety limit

  while (start < text.length && iterationCount < maxIterations) {
    iterationCount++
    
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

    const trimmedChunk = chunk.trim()
    if (trimmedChunk.length > 0) {
      chunks.push(trimmedChunk)
    }

    // Calculate next start position
    const nextStart = start + chunk.length - overlap
    
    // Safety check to prevent infinite loop
    if (nextStart <= start) {
      start = start + Math.max(1, chunkSize - overlap)
    } else {
      start = nextStart
    }
  }

  // If we hit the iteration limit, add the remaining text as one chunk
  if (start < text.length && iterationCount >= maxIterations) {
    const remainingText = text.slice(start).trim()
    if (remainingText.length > 0) {
      chunks.push(remainingText)
    }
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
    console.error('Error creating embedding:', {
      text: text.substring(0, 100) + '...',
      textLength: text.length,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw new Error(`Failed to create embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function createEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  try {
    console.log('Creating embeddings for', texts.length, 'texts')
    
    // Validate input
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array')
    }
    if (texts.length === 0) {
      return []
    }
    
    // Check for empty or invalid texts
    const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim().length > 0)
    if (validTexts.length !== texts.length) {
      console.warn(`Filtered out ${texts.length - validTexts.length} invalid texts`)
    }
    
    if (validTexts.length === 0) {
      throw new Error('No valid texts to process')
    }
    
    const embeddings = await generateEmbeddings(validTexts)
    console.log('Generated embeddings:', embeddings.length, 'embeddings')
    
    // Validate embeddings
    const expectedDimension = 1536
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i]
      if (!Array.isArray(embedding)) {
        throw new Error(`Embedding ${i} is not an array`)
      }
      if (embedding.length !== expectedDimension) {
        throw new Error(`Embedding ${i} has invalid length: ${embedding.length}, expected: ${expectedDimension}`)
      }
      if (embedding.some(val => typeof val !== 'number' || isNaN(val))) {
        throw new Error(`Embedding ${i} contains invalid values`)
      }
    }
    
    console.log('First embedding length:', embeddings[0]?.length)
    
    if (embeddings.length !== validTexts.length) {
      throw new Error(`Mismatch: ${validTexts.length} texts but ${embeddings.length} embeddings`)
    }
    
    return validTexts.map((text, index) => ({
      embedding: embeddings[index],
      tokenCount: Math.ceil(text.length / 4)
    }))
  } catch (error) {
    console.error('Error creating embeddings:', {
      textCount: texts.length,
      textLengths: texts.map(t => t.length),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw new Error(`Failed to create embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process document content into chunks with embeddings
 */
export async function processDocumentContent(
  content: string,
  documentId: string
): Promise<DocumentChunk[]> {
  console.log('=== ENTERING processDocumentContent ===')
  console.log('Parameters:', { documentId, contentType: typeof content, contentLength: content?.length })
  
  try {
    console.log('Starting document processing for:', documentId)
    console.log('Content length:', content.length)
    console.log('Content preview:', content.substring(0, 100) + '...')
    
    // Clean and prepare text
    const cleanText = content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    console.log('Clean text length:', cleanText.length)
    console.log('Clean text preview:', cleanText.substring(0, 100) + '...')

    if (!cleanText) {
      console.log('No clean text found, returning empty array')
      return []
    }

    // Chunk the text
    console.log('Starting text chunking...')
    let textChunks: string[]
    try {
      textChunks = chunkText(cleanText)
      console.log('Text chunks created:', textChunks.length)
      console.log('First chunk length:', textChunks[0]?.length)
      console.log('First chunk preview:', textChunks[0]?.substring(0, 100) + '...')
    } catch (chunkError) {
      console.error('Error in chunking:', chunkError)
      throw new Error(`Chunking failed: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`)
    }
    
    // Generate embeddings for all chunks
    const embeddingResults = await createEmbeddings(textChunks)
    console.log('Embedding results:', embeddingResults.length)
    console.log('First embedding result:', embeddingResults[0])
    
    // Create document chunks
    console.log('Creating document chunks...')
    const documentChunks: DocumentChunk[] = []
    
    try {
      for (let index = 0; index < textChunks.length; index++) {
        const chunk = textChunks[index]
        console.log(`Processing chunk ${index}:`, {
          chunkLength: chunk.length,
          hasEmbedding: !!embeddingResults[index],
          embeddingLength: embeddingResults[index]?.embedding?.length
        })
        
        if (!embeddingResults[index]) {
          throw new Error(`Missing embedding for chunk ${index}`)
        }
        
        if (!embeddingResults[index].embedding) {
          throw new Error(`Missing embedding array for chunk ${index}`)
        }
        
        const documentChunk: DocumentChunk = {
          id: `${documentId}-chunk-${index}`,
          documentId: documentId,
          content: chunk,
          embedding: embeddingResults[index].embedding,
          chunkIndex: index
        }
        
        documentChunks.push(documentChunk)
        console.log(`Created chunk ${index} successfully`)
      }
    } catch (chunkError) {
      console.error('Error creating document chunks:', chunkError)
      throw new Error(`Document chunk creation failed: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`)
    }

    return documentChunks
  } catch (error) {
    console.error('Error processing document content:', {
      documentId,
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + '...',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw new Error(`Failed to process document content: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
