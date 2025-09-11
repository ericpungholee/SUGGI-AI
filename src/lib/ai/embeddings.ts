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
 * Advanced chunking strategies for better RAG performance
 */

export interface ChunkingOptions {
  strategy?: 'semantic' | 'fixed' | 'hierarchical' | 'adaptive'
  chunkSize?: number
  overlap?: number
  minChunkSize?: number
  maxChunkSize?: number
  preserveStructure?: boolean
}

/**
 * Semantic chunking that respects document structure and meaning
 */
export function chunkTextSemantic(text: string, options: ChunkingOptions = {}): string[] {
  const {
    chunkSize = 800,
    overlap = 150,
    minChunkSize = 200,
    maxChunkSize = 1200,
    preserveStructure = true
  } = options

  if (!text || text.length === 0) {
    return []
  }
  
  if (text.length <= chunkSize) {
    return [text]
  }

  // First, split by major structural elements
  const sections = splitByStructure(text, preserveStructure)
  const chunks: string[] = []

  for (const section of sections) {
    if (section.length <= chunkSize) {
      chunks.push(section)
    } else {
      // Further chunk large sections
      const subChunks = chunkBySentences(section, chunkSize, overlap, minChunkSize, maxChunkSize)
      chunks.push(...subChunks)
    }
  }

  return chunks.filter(chunk => chunk.trim().length > 0)
}

/**
 * Split text by document structure (headers, paragraphs, etc.)
 */
function splitByStructure(text: string, preserveStructure: boolean): string[] {
  if (!preserveStructure) {
    return [text]
  }

  // Split by major headers (markdown style)
  const headerRegex = /^#{1,6}\s+.+$/gm
  const sections: string[] = []
  let lastIndex = 0
  let match

  while ((match = headerRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const section = text.slice(lastIndex, match.index).trim()
      if (section.length > 0) {
        sections.push(section)
      }
    }
    lastIndex = match.index
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const section = text.slice(lastIndex).trim()
    if (section.length > 0) {
      sections.push(section)
    }
  }

  return sections.length > 0 ? sections : [text]
}

/**
 * Chunk by sentences with smart boundary detection
 */
function chunkBySentences(
  text: string, 
  targetSize: number, 
  overlap: number, 
  minSize: number, 
  maxSize: number
): string[] {
  const sentences = splitIntoSentences(text)
  const chunks: string[] = []
  let currentChunk = ''
  let currentSize = 0

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const sentenceSize = sentence.length

    // If adding this sentence would exceed max size, start a new chunk
    if (currentSize + sentenceSize > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
      currentSize = 0
    }

    // Add sentence to current chunk
    currentChunk += (currentChunk ? ' ' : '') + sentence
    currentSize += sentenceSize

    // If we've reached target size or this is the last sentence, finalize chunk
    if (currentSize >= targetSize || i === sentences.length - 1) {
      if (currentChunk.trim().length >= minSize) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
        currentSize = 0
      }
    }
  }

  // Add any remaining text
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Split text into sentences using advanced patterns
 */
function splitIntoSentences(text: string): string[] {
  // Enhanced sentence splitting regex
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*\n\s*(?=[A-Z])/g
  const sentences = text.split(sentenceRegex)
  
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Hierarchical chunking for complex documents
 */
export function chunkTextHierarchical(text: string, options: ChunkingOptions = {}): string[] {
  const {
    chunkSize = 1000,
    overlap = 200
  } = options

  // First level: Split by major sections
  const majorSections = splitByStructure(text, true)
  const allChunks: string[] = []

  for (const section of majorSections) {
    if (section.length <= chunkSize) {
      allChunks.push(section)
    } else {
      // Second level: Split by paragraphs
      const paragraphs = section.split(/\n\s*\n/).filter(p => p.trim().length > 0)
      let currentChunk = ''
      
      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length <= chunkSize) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph
        } else {
          if (currentChunk.trim().length > 0) {
            allChunks.push(currentChunk.trim())
          }
          currentChunk = paragraph
        }
      }
      
      if (currentChunk.trim().length > 0) {
        allChunks.push(currentChunk.trim())
      }
    }
  }

  return allChunks.filter(chunk => chunk.length > 0)
}

/**
 * Adaptive chunking based on content type and complexity
 */
export function chunkTextAdaptive(text: string, options: ChunkingOptions = {}): string[] {
  // Analyze text characteristics
  const hasHeaders = /^#{1,6}\s+/m.test(text)
  const hasLists = /^\s*[-*+]\s+/m.test(text) || /^\s*\d+\.\s+/m.test(text)
  const avgSentenceLength = text.split(/[.!?]+/).reduce((sum, s) => sum + s.length, 0) / text.split(/[.!?]+/).length
  const hasTables = /\|.*\|/.test(text)
  const hasCode = /```|`[^`]+`/.test(text)
  
  // Choose strategy based on content
  if (hasHeaders) {
    return chunkTextHierarchical(text, options)
  } else if (hasTables || hasCode) {
    // For structured content, use smaller chunks with more overlap
    return chunkTextSemantic(text, { 
      ...options, 
      chunkSize: 400, 
      overlap: 150,
      minChunkSize: 100,
      maxChunkSize: 800
    })
  } else if (hasLists || avgSentenceLength > 100) {
    return chunkTextSemantic(text, { 
      ...options, 
      chunkSize: 600, 
      overlap: 120,
      minChunkSize: 150,
      maxChunkSize: 1000
    })
  } else {
    // Default: balanced chunking for general content
    return chunkTextSemantic(text, {
      ...options,
      chunkSize: 800,
      overlap: 150,
      minChunkSize: 200,
      maxChunkSize: 1200
    })
  }
}

/**
 * Main chunking function with strategy selection
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  return chunkTextSemantic(text, {
    chunkSize,
    overlap,
    minChunkSize: Math.floor(chunkSize * 0.3),
    maxChunkSize: Math.floor(chunkSize * 1.5),
    preserveStructure: true
  })
}

/**
 * Generate embedding for a single text
 */
export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const embedding = await generateEmbedding(text, { model: 'text-embedding-ada-002' })
    
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
    
    const embeddings = await generateEmbeddings(validTexts, { model: 'text-embedding-ada-002' })
    console.log('Generated embeddings:', embeddings.length, 'embeddings')
    
    // Validate embeddings
    const expectedDimension = 1536 // Updated for text-embedding-ada-002
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

    // Chunk the text using adaptive strategy
    console.log('Starting adaptive text chunking...')
    let textChunks: string[]
    try {
      textChunks = chunkTextAdaptive(cleanText, {
        chunkSize: 800,
        overlap: 150,
        minChunkSize: 200,
        maxChunkSize: 1200,
        preserveStructure: true
      })
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
    console.warn(`Vector dimension mismatch: ${a.length} vs ${b.length}. Attempting to handle gracefully.`)
    
    // Handle dimension mismatch gracefully
    if (a.length === 0 || b.length === 0) {
      return 0
    }
    
    // If one is 1536 and other is 3072, pad the smaller one with zeros
    if ((a.length === 1536 && b.length === 3072) || (a.length === 3072 && b.length === 1536)) {
      const targetLength = Math.max(a.length, b.length)
      const paddedA = a.length < targetLength ? [...a, ...new Array(targetLength - a.length).fill(0)] : a
      const paddedB = b.length < targetLength ? [...b, ...new Array(targetLength - b.length).fill(0)] : b
      return cosineSimilarity(paddedA, paddedB)
    }
    
    // For other mismatches, return 0 (no similarity)
    return 0
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
 * Query expansion and rewriting for better retrieval
 */
export async function expandQuery(query: string): Promise<string[]> {
  try {
    // Only expand queries that are likely to benefit from expansion
    const shouldExpand = query.length > 10 && 
      !query.includes('?') && // Don't expand questions
      !/^(what|who|when|where|why|how)\s/i.test(query) && // Don't expand simple questions
      query.split(/\s+/).length >= 3 // Only expand multi-word queries
    
    if (!shouldExpand) {
      return [query]
    }

    const { generateChatCompletion } = await import('./openai')
    
    const expansionPrompt = `Given the following search query, generate 2-3 alternative phrasings that would help find relevant information. Focus on synonyms and different ways to express the same core concept. Keep alternatives close to the original meaning.

Original query: "${query}"

Generate alternatives in this format:
1. [alternative query 1]
2. [alternative query 2]
3. [alternative query 3]

Make sure each alternative:
- Is semantically very close to the original query
- Uses different vocabulary but same core meaning
- Is concise and searchable
- Maintains the specific intent`

    const response = await generateChatCompletion([
      { role: 'user', content: expansionPrompt }
    ], {
      model: 'gpt-5-nano',
      temperature: 0.3, // Lower temperature for more conservative expansion
      max_tokens: 300
    })

    const expandedText = response.choices[0]?.message?.content || ''
    const alternatives = expandedText
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(alt => alt.length > 0 && alt.length < query.length * 2) // Avoid overly long alternatives

    return [query, ...alternatives].slice(0, 3) // Include original + up to 2 alternatives
  } catch (error) {
    console.error('Error expanding query:', error)
    return [query] // Fallback to original query
  }
}

/**
 * Enhanced query rewriting for better semantic matching
 */
export async function rewriteQuery(query: string): Promise<string> {
  try {
    // Only rewrite queries that are likely to benefit from rewriting
    const shouldRewrite = query.length > 5 && 
      !query.includes('?') && // Don't rewrite questions
      !/^(what|who|when|where|why|how)\s/i.test(query) && // Don't rewrite simple questions
      query.split(/\s+/).length >= 2 // Only rewrite multi-word queries
    
    if (!shouldRewrite) {
      return query
    }

    const { generateChatCompletion } = await import('./openai')
    
    const rewritePrompt = `Rewrite the following search query to be more effective for finding relevant information in a document database. Focus on:

1. Using specific, searchable keywords that are likely to appear in documents
2. Making the query more explicit and detailed
3. Adding context that would help find relevant content
4. Using terms that are commonly found in technical or research documents

Original query: "${query}"

Provide a rewritten query that is more likely to find relevant information. Keep it concise but comprehensive. Do not change the core meaning or intent.

Rewritten query:`

    const response = await generateChatCompletion([
      { role: 'user', content: rewritePrompt }
    ], {
      model: 'gpt-5-nano',
      temperature: 0.1, // Very low temperature for conservative rewriting
      max_tokens: 100
    })

    const rewritten = response.choices[0]?.message?.content?.trim() || query
    
    // If the rewritten query is too different or too long, fallback to original
    if (rewritten.length > query.length * 2 || rewritten.length < query.length * 0.7) {
      return query
    }
    
    return rewritten
  } catch (error) {
    console.error('Error rewriting query:', error)
    return query
  }
}

/**
 * Find most similar chunks based on embedding similarity with advanced scoring
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  limit: number = 5,
  threshold: number = 0.7
): DocumentChunk[] {
  const similarities = chunks.map(chunk => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
    
    // Boost score for chunks with more content (more informative)
    const contentBoost = Math.min(1.2, 1 + (chunk.content.length / 1000) * 0.1)
    
    // Boost score for chunks that appear earlier in documents (often more important)
    const positionBoost = Math.max(0.9, 1 - (chunk.chunkIndex / 100) * 0.1)
    
    const boostedSimilarity = similarity * contentBoost * positionBoost
    
    return {
    chunk,
      similarity: boostedSimilarity,
      originalSimilarity: similarity
    }
  })

  return similarities
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => item.chunk)
}

/**
 * Enhanced hybrid search combining semantic and keyword matching
 */
export function hybridSearch(
  query: string,
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  limit: number = 5,
  semanticWeight: number = 0.7,
  keywordWeight: number = 0.3
): DocumentChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
  
  const scoredChunks = chunks.map(chunk => {
    // Semantic similarity score
    const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding)
    
    // Enhanced keyword matching score
    const content = chunk.content.toLowerCase()
    const keywordMatches = queryTerms.filter(term => content.includes(term)).length
    const keywordScore = queryTerms.length > 0 ? keywordMatches / queryTerms.length : 0
    
    // Phrase matching bonus (exact phrase matches get higher score)
    const phraseScore = queryTerms.length > 1 ? 
      (content.includes(query.toLowerCase()) ? 0.3 : 0) : 0
    
    // Proximity bonus (terms close together get higher score)
    let proximityBonus = 0
    if (queryTerms.length > 1) {
      const termPositions = queryTerms.map(term => content.indexOf(term)).filter(pos => pos !== -1)
      if (termPositions.length > 1) {
        const avgDistance = termPositions.reduce((sum, pos, i) => 
          i > 0 ? sum + Math.abs(pos - termPositions[i-1]) : sum, 0) / (termPositions.length - 1)
        proximityBonus = Math.max(0, 0.2 - (avgDistance / 100)) // Closer terms = higher bonus
      }
    }
    
    // Content quality bonus
    const hasNumbers = /\d+/.test(chunk.content)
    const hasSpecificTerms = /(?:specifically|particularly|exactly|precisely|detailed|analysis|research|study)/i.test(chunk.content)
    const qualityBonus = (hasNumbers ? 0.1 : 0) + (hasSpecificTerms ? 0.1 : 0)
    
    // Enhanced combined score
    const enhancedKeywordScore = keywordScore + phraseScore + proximityBonus
    const combinedScore = (semanticScore * semanticWeight) + (enhancedKeywordScore * keywordWeight) + qualityBonus
    
    return {
      chunk,
      score: combinedScore,
      semanticScore,
      keywordScore: enhancedKeywordScore,
      phraseScore,
      proximityBonus,
      qualityBonus
    }
  })

  return scoredChunks
    .filter(item => item.score >= 0.2) // Slightly lower threshold for better recall
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.chunk)
}

/**
 * Compress and summarize context for better token efficiency
 */
export async function compressContext(
  context: string,
  maxTokens: number = 2000
): Promise<string> {
  try {
    const { generateChatCompletion } = await import('./openai')
    
    // Rough token estimation (1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(context.length / 4)
    
    if (estimatedTokens <= maxTokens) {
      return context
    }

    const compressionPrompt = `Compress and summarize the following document context while preserving all key information relevant to the user's query. Focus on:

1. Key facts and important details
2. Specific data points and numbers
3. Important quotes or statements
4. Relevant examples or case studies
5. Critical relationships between concepts

Remove:
- Redundant information
- Unnecessary details
- Filler words and phrases
- Less relevant background information

Maintain the original structure and document references. Keep the response concise but comprehensive.

Context to compress:
${context}

Compressed context:`

    const response = await generateChatCompletion([
      { role: 'user', content: compressionPrompt }
    ], {
      model: 'gpt-5-nano',
      temperature: 0.3,
      max_tokens: Math.floor(maxTokens * 0.8) // Leave room for response
    })

    return response.choices[0]?.message?.content?.trim() || context
  } catch (error) {
    console.error('Error compressing context:', error)
    // Fallback: simple truncation
    const maxLength = maxTokens * 4
    return context.length > maxLength 
      ? context.substring(0, maxLength) + '...'
      : context
  }
}

/**
 * Extract key information from context for better focus
 */
export async function extractKeyInformation(
  context: string,
  query: string
): Promise<string> {
  try {
    const { generateChatCompletion } = await import('./openai')
    
    const extractionPrompt = `Extract the most relevant information from the following document context that directly answers or relates to the user's query.

User Query: "${query}"

Document Context:
${context}

Extract and present only the information that is:
1. Directly relevant to answering the query
2. Factually accurate and specific
3. Well-supported by the context
4. Clearly attributed to source documents

Format as a focused summary with clear document references. If no relevant information is found, state that clearly.

Relevant Information:`

    const response = await generateChatCompletion([
      { role: 'user', content: extractionPrompt }
    ], {
      model: 'gpt-5-nano',
      temperature: 0.2,
      max_tokens: 1000
    })

    return response.choices[0]?.message?.content?.trim() || context
  } catch (error) {
    console.error('Error extracting key information:', error)
    return context
  }
}

/**
 * Query intent classification for adaptive retrieval strategies
 */
export interface QueryIntent {
  type: 'factual' | 'analytical' | 'creative' | 'comparative' | 'procedural' | 'summarization'
  confidence: number
  suggestedStrategy: 'semantic' | 'hybrid' | 'keyword'
  suggestedLimit: number
  needsContext: boolean
}

export async function classifyQueryIntent(query: string): Promise<QueryIntent> {
  try {
    const { generateChatCompletion } = await import('./openai')
    
    const classificationPrompt = `Classify this query for RAG retrieval strategy. Respond ONLY with valid JSON, no other text.

Query: "${query}"

Categories: factual, analytical, creative, comparative, procedural, summarization

Return this exact JSON format:
{
  "type": "factual",
  "confidence": 0.9,
  "suggestedStrategy": "hybrid",
  "suggestedLimit": 8,
  "needsContext": true
}

Rules:
- type: one of the 6 categories
- confidence: 0.0 to 1.0
- suggestedStrategy: "semantic", "hybrid", or "keyword"
- suggestedLimit: 3-15
- needsContext: true or false`

    // Add timeout to prevent hanging
    const response = await Promise.race([
      generateChatCompletion([
        { role: 'user', content: classificationPrompt }
      ], {
        model: 'gpt-5-nano',
        temperature: 0.1,
        max_tokens: 200
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query classification timeout')), 5000)
      )
    ]) as any

    const result = response.choices[0]?.message?.content?.trim()
    if (result) {
      try {
        // Try to extract JSON from the response if it's not pure JSON
        let jsonStr = result
        
        // Look for JSON object in the response
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonStr = jsonMatch[0]
        }
        
        const parsed = JSON.parse(jsonStr)
        return {
          type: parsed.type || 'factual',
          confidence: parsed.confidence || 0.5,
          suggestedStrategy: parsed.suggestedStrategy || 'hybrid',
          suggestedLimit: parsed.suggestedLimit || 5,
          needsContext: parsed.needsContext !== false
        }
      } catch (parseError) {
        console.error('Error parsing query intent:', parseError)
        console.error('Raw response:', result)
        
        // Fallback: try to extract information using regex
        const typeMatch = result.match(/type["\s]*:["\s]*["']?(\w+)["']?/i)
        const confidenceMatch = result.match(/confidence["\s]*:["\s]*(\d+\.?\d*)/i)
        const strategyMatch = result.match(/suggestedStrategy["\s]*:["\s]*["']?(\w+)["']?/i)
        const limitMatch = result.match(/suggestedLimit["\s]*:["\s]*(\d+)/i)
        
        return {
          type: typeMatch?.[1] || 'factual',
          confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
          suggestedStrategy: strategyMatch?.[1] || 'hybrid',
          suggestedLimit: limitMatch ? parseInt(limitMatch[1]) : 5,
          needsContext: true
        }
      }
    }
  } catch (error) {
    console.error('Error classifying query intent:', error)
  }

  // Fallback to default classification
  return {
    type: 'factual',
    confidence: 0.5,
    suggestedStrategy: 'hybrid',
    suggestedLimit: 5,
    needsContext: true
  }
}

/**
 * Adaptive retrieval based on query intent
 */
export async function adaptiveRetrieval(
  query: string,
  userId: string,
  options: DocumentSearchOptions = {}
): Promise<SearchResult[]> {
  try {
    // Classify query intent with timeout and fallback
    let intent: QueryIntent
    try {
      intent = await classifyQueryIntent(query)
      console.log('Query intent classified:', intent)
    } catch (classificationError) {
      console.warn('Query classification failed, using default settings:', classificationError)
      // Use default intent if classification fails
      intent = {
        type: 'factual',
        confidence: 0.5,
        suggestedStrategy: 'hybrid',
        suggestedLimit: 5,
        needsContext: true
      }
    }

    // Adjust search parameters based on intent
    const adaptiveOptions: DocumentSearchOptions = {
      ...options,
      limit: intent.suggestedLimit,
      searchStrategy: intent.suggestedStrategy,
      useHybridSearch: intent.suggestedStrategy === 'hybrid',
      useQueryExpansion: intent.type === 'analytical' || intent.type === 'comparative',
      useQueryRewriting: intent.type === 'factual' || intent.type === 'procedural',
      threshold: intent.type === 'factual' ? 0.2 : 0.1 // Higher threshold for factual queries
    }

    // Perform search with adaptive parameters - ensure no recursion
    const { searchSimilarDocuments } = await import('./vector-search')
    const nonRecursiveOptions = { ...adaptiveOptions, useAdaptiveRetrieval: false }
    const results = await searchSimilarDocuments(query, userId, nonRecursiveOptions)

    // Post-process results based on intent
    if (intent.type === 'summarization' && results.length > 3) {
      // For summarization, prefer chunks from different parts of documents
      const uniqueDocs = new Set<string>()
      const filteredResults = results.filter(result => {
        if (uniqueDocs.has(result.documentId)) return false
        uniqueDocs.add(result.documentId)
        return true
      })
      return filteredResults.slice(0, intent.suggestedLimit)
    }

    return results.slice(0, intent.suggestedLimit)
  } catch (error) {
    console.error('Error in adaptive retrieval:', error)
    // Fallback to standard search without adaptive retrieval
    const { searchSimilarDocuments } = await import('./vector-search')
    const fallbackOptions = { ...options, useAdaptiveRetrieval: false }
    return searchSimilarDocuments(query, userId, fallbackOptions)
  }
}
