import { ragAdapter, RagChunk, buildEvidenceBundle } from './rag-adapter'
import { routerService } from './router-service'
import { RouterContext } from './intent-schema'
import { fillInstructionJSON, InstructionJSON, generateSystemPrompt } from './instruction-json'
import { verifyInstruction, VerificationResult, validateResponse } from './rag-verification'
import { generateChatCompletion } from './openai'
import { getChatModel, getRoutingModel } from './core/models'

export interface RAGOrchestratorOptions {
  userId: string
  documentId?: string
  maxTokens?: number
  enableWebSearch?: boolean
  webSearchTimeout?: number
  conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>
}

export interface RAGResponse {
  content: string
  citations: string[]
  metadata: {
    task: string
    ragConfidence: number
    coverage: number
    totalTokens: number
    processingTime: number
    sourcesUsed: number
    shouldTriggerLiveEdit?: boolean
  }
  verification: VerificationResult
  liveEditContent?: string
}

/**
 * Main RAG orchestrator implementing the RAG-first approach
 */
export class RAGOrchestrator {
  private options: RAGOrchestratorOptions

  constructor(options: RAGOrchestratorOptions) {
    this.options = {
      maxTokens: 2000,
      enableWebSearch: false,
      webSearchTimeout: 3500,
      ...options
    }
  }

  /**
   * Infer a simple task label from the router result and query text
   */
  private inferTask(routerResult: any, ask: string): string {
    const intent: string = routerResult?.classification?.intent || 'ask'
    const lowerAsk = (ask || '').toLowerCase()

    // Writing-like cues in either intent or natural language
    const writingKeywords = ['write', 'create', 'generate', 'compose', 'draft', 'report', 'document', 'analysis', 'summary', 'add', 'insert']
    const isWritingByText = writingKeywords.some((kw) => lowerAsk.includes(kw))

    if (intent === 'editor_write' || (intent === 'rag_query' && isWritingByText)) return 'write'
    if (intent === 'edit_request') return 'edit'
    if (intent === 'web_search') return 'web_search'
    if (intent === 'rag_query') return 'rag'
    return 'ask'
  }

  /**
   * Process user query through RAG-first pipeline
   */
  async processQuery(
    ask: string,
    selection?: string,
    session?: any
  ): Promise<RAGResponse> {
    const startTime = Date.now()
    
    try {
      // 1. Use hybrid router for intent classification
      const routerContext: RouterContext = {
        has_attached_docs: !!this.options.documentId,
        doc_ids: this.options.documentId ? [this.options.documentId] : [],
        is_selection_present: !!selection && selection.length > 0,
        selection_length: selection?.length || 0,
        recent_tools: [],
        conversation_length: this.options.conversationHistory?.length || 0,
        user_id: this.options.userId,
        document_id: this.options.documentId
      }

      const routerResult = await routerService.classifyIntent(ask, routerContext)
      
      // 2. Check if query is relevant to user's documents
      const isRelevantToDocuments = routerResult.classification.intent === 'rag_query'
      
      // Log router decision with explanation
      console.log('🔍 RAG Router Decision:', {
        intent: routerResult.classification.intent,
        confidence: routerResult.classification.confidence,
        method: (routerResult as any).explanation?.method || 'unknown',
        reasoning: (routerResult as any).explanation?.reasoning,
        isRelevantToDocuments
      })
      
      let ragHits: RagChunk[] = []
      let ragCtx: RagChunk[] = []
      let ragConf = 0
      let coverage = 0

      // 3. Only search RAG if query is relevant to documents
      if (isRelevantToDocuments) {
        ragHits = await ragAdapter.search(ask, {
          topK: 30,
          projectId: this.options.userId
        })

        // Expand hierarchy and pack context
        ragCtx = await ragAdapter.packContext(
          await ragAdapter.expandHierarchy(ragHits, 1, true),
          this.options.maxTokens! * 0.7 // Use 70% of budget for RAG
        )
        
        ragConf = ragAdapter.confidence(ragHits)
        coverage = this.calculateCoverage(ragHits)
      }

      // 4. Decide if web search is needed
      const useWeb = this.shouldUseWeb(routerResult, ragConf, coverage, isRelevantToDocuments)
      let webResults: any[] = []

      if (useWeb && this.options.enableWebSearch) {
        // Extract search terms from the user prompt, removing writing instructions
        const searchQuery = await this.extractSearchTerms(ask)
        webResults = await this.performWebSearch(searchQuery, this.options.webSearchTimeout!)
      }

      // 5. Build evidence bundle
      const evidence = buildEvidenceBundle(ragCtx, webResults)
      
      // 6. Calculate improved coverage including web results
      const task = this.inferTask(routerResult, ask)
      const improvedCoverage = this.calculateImprovedCoverage(ragCtx, webResults, task)
      
      // 7. Create instruction JSON
      const instruction = await fillInstructionJSON(
        routerResult,
        ask,
        selection,
        ragCtx,
        webResults,
        ragConf,
        improvedCoverage
      )

      // 8. Verify instruction
      
      // For writing tasks, be more lenient with coverage requirements
      const isWritingTask = task === 'write' || ['create', 'generate', 'compose', 'draft', 'report', 'document'].some((w) => 
        task.toLowerCase().includes(w)
      )
      
      const verification = await verifyInstruction(instruction, ragCtx, {
        checkChunkHash: true,
        requireMinCoverage: !isWritingTask, // Don't require coverage for writing tasks
        minCoverageThreshold: isWritingTask ? 0.2 : 0.5 // Lower threshold for writing tasks
      })

      if (!verification.isValid) {
        console.warn('⚠️ Instruction verification failed:', verification.errors)
        // Continue with warnings - don't fail completely
      }

      // 9. Execute the plan
      const response = await this.executePlan(instruction, ask, selection)

      // 10. Validate response
      const responseValidation = validateResponse(response.content, instruction)

      const processingTime = Date.now() - startTime

      // Check if the response should trigger live editing
      const shouldTriggerLiveEdit = this.shouldTriggerLiveEdit(response.content, task)
      const liveEditContent = shouldTriggerLiveEdit ? this.extractContentForLiveEdit(response.content) : undefined

      return {
        content: response.content,
        citations: response.citations,
        metadata: {
          task,
          ragConfidence: ragConf,
          coverage: improvedCoverage,
          totalTokens: evidence.totalTokens,
          processingTime,
          sourcesUsed: ragCtx.length + webResults.length,
          shouldTriggerLiveEdit
        },
        verification,
        liveEditContent
      }

    } catch (error) {
      console.error('❌ Orchestration failed:', error)
      throw new Error(`RAG orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Determine if web search should be used
   */
  private shouldUseWeb(routerResult: any, ragConf: number, coverage: number, isRelevantToDocuments: boolean): boolean {
    // Don't use web if explicitly disabled
    if (!this.options.enableWebSearch) return false

    // Use web search based on router decision
    if (routerResult.classification.intent === 'web_search') return true
    if (routerResult.classification.intent === 'ask' && routerResult.classification.slots.needs_recency) return true

    // If query is not relevant to documents, use web search for current information
    if (!isRelevantToDocuments) return true

    // Use web if RAG confidence is low or coverage is poor
    const lowConfidence = ragConf < 0.7
    const poorCoverage = coverage < 0.5

    return lowConfidence || poorCoverage
  }

  /**
   * Perform web search with timeout
   */
  private async performWebSearch(query: string, timeoutMs: number): Promise<any[]> {
    try {
      // Use a simple web search implementation
      // For production, you'd want to use a proper search API like SerpAPI, Google Custom Search, etc.
      const searchResults = await this.searchWeb(query)
      
      return searchResults
    } catch (error) {
      console.error('Web search failed:', error)
      return []
    }
  }

  /**
   * Extract search terms from user prompt, removing writing instructions
   */
  private async extractSearchTerms(userPrompt: string): Promise<string> {
    try {
      // Use GPT to extract search terms from the user prompt
      const extractionPrompt = `Extract only the search terms from this user prompt, removing any writing instructions or commands.

User Prompt: "${userPrompt}"

Extract only the key terms that should be searched for information. Remove words like:
- "write", "create", "generate", "compose", "draft", "make", "build"
- "report", "document", "analysis", "summary", "essay", "article"
- "use", "get", "find", "search", "look up"
- "real", "current", "latest", "recent", "up-to-date"
- "metrics", "data", "information", "facts"

Return only the core search terms that describe what information to find.

Examples:
- "write a report on tesla stock. use real metrics" → "tesla stock metrics"
- "create an analysis of apple earnings" → "apple earnings"
- "generate a summary of climate change data" → "climate change data"
- "write about the latest AI developments" → "AI developments"

Return only the search terms:`

      const response = await generateChatCompletion([
        { role: 'user', content: extractionPrompt }
      ], {
        model: getRoutingModel(),
        temperature: 0.1,
        max_tokens: 50
      })

      const extractedTerms = response.choices[0]?.message?.content?.trim() || userPrompt
      
      // Fallback: if extraction fails, try simple keyword extraction
      if (extractedTerms === userPrompt || extractedTerms.length > userPrompt.length * 0.8) {
        return this.simpleKeywordExtraction(userPrompt)
      }
      
      return extractedTerms
    } catch (error) {
      console.error('Error extracting search terms:', error)
      return this.simpleKeywordExtraction(userPrompt)
    }
  }

  /**
   * Simple keyword extraction as fallback
   */
  private simpleKeywordExtraction(userPrompt: string): string {
    // Remove common writing instruction words
    const writingWords = [
      'write', 'create', 'generate', 'compose', 'draft', 'make', 'build',
      'report', 'document', 'analysis', 'summary', 'essay', 'article',
      'use', 'get', 'find', 'search', 'look up', 'about', 'on',
      'real', 'current', 'latest', 'recent', 'up-to-date',
      'metrics', 'data', 'information', 'facts'
    ]
    
    let terms = userPrompt.toLowerCase()
    
    // Remove writing instruction words
    writingWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      terms = terms.replace(regex, '')
    })
    
    // Clean up extra spaces and punctuation
    terms = terms.replace(/[^\w\s]/g, ' ')
    terms = terms.replace(/\s+/g, ' ').trim()
    
    return terms || userPrompt
  }

  /**
   * Web search using GPT-5 web_search tool
   */
  private async searchWeb(query: string): Promise<any[]> {
    try {
      console.log('🔍 Performing web search for:', query)
      
      // Use direct web search function
      const { webSearch } = await import('./services/web-search')
      
      const result = await webSearch({
        prompt: `Search for current information about: ${query}`,
        model: getChatModel(),
        maxResults: 8,
        includeImages: false,
        searchRegion: 'US',
        language: 'en',
        timeoutMs: 20000 // Reduced timeout
      })
      
      console.log('✅ Web search completed, found', result.citations.length, 'citations')
      
      // Convert to expected format
      return result.citations.map((citation) => ({
        title: citation.title || 'Web Result',
        url: citation.url,
        content: result.text || '',
        type: 'web'
      }))
    } catch (error) {
      console.error('Web search error:', error)
      // Return empty results on failure rather than fallback
      return []
    }
  }


  /**
   * Execute the instruction plan
   */
  private async executePlan(
    instruction: InstructionJSON,
    ask: string,
    selection?: string
  ): Promise<{ content: string; citations: string[] }> {
    try {
      // Generate system prompt from instruction
      const systemPrompt = generateSystemPrompt(instruction)

      // Prepare messages
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: ask }
      ]

      if (selection) {
        messages.push({
          role: 'user' as const,
          content: `Selected text: ${selection}`
        })
      }

      // Generate response
      const response = await generateChatCompletion(messages, {
        model: getChatModel(), // Use GPT-5 as primary model
        temperature: instruction.needs?.creativity === 'high' ? 0.8 : 0.3,
        max_tokens: instruction.policies.max_tokens || 2000
      })

      const content = response.choices[0]?.message?.content || 'No response generated'

      // Extract citations from response
      const citations = this.extractCitations(content, instruction.context_refs)

      return { content, citations }
    } catch (error) {
      console.error('Plan execution failed:', error)
      throw new Error(`Failed to execute plan: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract citations from response content
   */
  private extractCitations(content: string, contextRefs: any[]): string[] {
    const citations: string[] = []
    
    // Find citation patterns like [1], [2], etc.
    const citationMatches = content.match(/\[(\d+)\]/g)
    
    if (citationMatches) {
      citationMatches.forEach(match => {
        const index = parseInt(match.replace(/[\[\]]/g, '')) - 1
        if (index >= 0 && index < contextRefs.length) {
          const ref = contextRefs[index]
          citations.push(`${match}: ${ref.type === 'doc' ? 'Document' : 'Web'} - ${ref.id}`)
        }
      })
    }

    return citations
  }

  /**
   * Check if query is relevant to user's documents using LLM
   */
  private async isQueryRelevantToDocuments(query: string, routerResult: any): Promise<boolean> {
    try {
      // Skip relevance check for certain task types that should always use web search
      if (routerResult.classification.intent === 'web_search') {
        return false
      }

      // Check if query is asking for current information that wouldn't be in documents
      const currentInfoKeywords = [
        'current', 'latest', 'recent', 'today', 'now', '2024', '2025',
        'news', 'stock', 'price', 'market', 'financial', 'earnings',
        'weather', 'time', 'date', 'live', 'real-time', 'real data'
      ]
      
      const lowerQuery = query.toLowerCase()
      const hasCurrentInfoKeywords = currentInfoKeywords.some(keyword => lowerQuery.includes(keyword))
      
      if (hasCurrentInfoKeywords) {
        return false
      }

      // Use LLM to determine relevance
      const relevancePrompt = `Analyze if this user query is asking about content that would likely be found in personal documents, notes, or files that the user has uploaded to their knowledge base.

User Query: "${query}"

Consider:
- Is this asking about personal content, documents, or files?
- Is this asking about general knowledge that wouldn't be in personal documents?
- Is this asking for current information, news, or real-time data?
- Is this asking for creative writing, analysis, or general conversation?

Respond with ONLY "true" if the query is likely about personal documents/content, or "false" if it's about general knowledge, current events, or doesn't relate to personal documents.

Examples:
- "What did I write about Tesla?" → true
- "Summarize my notes on AI" → true  
- "What's the current Tesla stock price?" → false
- "Write a story about robots" → false
- "Give me an analysis on Tesla stock using real data" → false
- "What's the weather today?" → false
- "Create a table" → false (general writing, not document editing)
- "Edit this paragraph" → true (document editing)
- "Rewrite this section" → true (document editing)`

      const response = await generateChatCompletion([
        { role: 'user', content: relevancePrompt }
      ], {
        model: getRoutingModel(),
        temperature: 0.1,
        max_tokens: 10
      })

      const result = response.choices[0]?.message?.content?.trim().toLowerCase()
      return result === 'true'
    } catch (error) {
      console.error('Error checking query relevance:', error)
      // Default to true to be safe and use RAG
      return true
    }
  }

  /**
   * Calculate coverage based on unique sections
   */
  private calculateCoverage(chunks: RagChunk[]): number {
    const uniqueDocs = new Set(chunks.map(chunk => chunk.docId))
    // Simple coverage calculation - could be more sophisticated
    return Math.min(1, uniqueDocs.size / 8) // Assume 8 sections is full coverage
  }

  /**
   * Calculate improved coverage including web results and task-specific adjustments
   */
  private calculateImprovedCoverage(ragChunks: RagChunk[], webResults: any[], task: string): number {
    // Base coverage from RAG chunks
    const ragCoverage = this.calculateCoverage(ragChunks)
    
    // Web search contribution (each web result adds 0.1 coverage, max 0.5)
    const webCoverage = Math.min(0.5, webResults.length * 0.1)
    
    // Task-specific adjustments
    const isWritingTask = task === 'write' || ['create', 'generate', 'compose', 'draft', 'report', 'document'].some((w) => 
      task.toLowerCase().includes(w)
    )
    
    // For writing tasks, be more lenient - minimum 0.3 if we have any content
    if (isWritingTask) {
      const hasAnyContent = ragChunks.length > 0 || webResults.length > 0
      return hasAnyContent ? Math.max(0.3, ragCoverage + webCoverage) : 0.0
    }
    
    // For other tasks, combine RAG and web coverage
    return Math.min(1.0, ragCoverage + webCoverage)
  }

  /**
   * Check if the response should trigger live editing
   */
  private shouldTriggerLiveEdit(content: string, task: string): boolean {
    // Only allow live editing when task is explicitly a writing action
    const isWritingTask = task === 'write'

    // Check for trigger phrases in content
    const triggerPhrases = [
      'I\'ll write', 'I\'m writing', 'Let me write',
      'Here\'s the', 'Here is the', 'I\'ll create',
      'I\'m creating', 'I\'ll add', 'I\'m adding',
      'I\'ll insert', 'I\'m inserting', 'Writing:',
      'Creating:', 'Adding:', 'I\'ll provide',
      'I\'m providing', 'Let me provide', 'Here\'s a',
      'Here is a', 'I\'ll draft', 'I\'m drafting'
    ]

    const hasTriggerPhrase = triggerPhrases.some(phrase => 
      content.includes(phrase)
    )

    // Check if content looks like a report or document (long structured content)
    const isStructuredContent = content.length > 500 && (
      content.includes('#') || // Has headers
      content.includes('##') || // Has subheaders
      content.includes('**') || // Has bold text
      content.includes('1.') || // Has numbered lists
      content.includes('- ') || // Has bullet points
      content.includes('|') // Has tables
    )

    // Check if user asked for a report or document
    const isReportRequest = task.includes('report') || 
                           task.includes('document') || 
                           task.includes('analysis') ||
                           task.includes('summary')

    // For any writing-related request, always trigger live editing
    const isAnyWritingRequest = task.includes('write') || 
                               task.includes('create') || 
                               task.includes('generate') ||
                               task.includes('compose') ||
                               task.includes('draft') ||
                               task.includes('add') ||
                               task.includes('insert') ||
                               task.includes('report') ||
                               task.includes('document') ||
                               task.includes('analysis') ||
                               task.includes('summary')

    const result = isWritingTask && (hasTriggerPhrase || isStructuredContent || isAnyWritingRequest)
    
    // Debug information for live editing trigger
    console.log('🔍 RAG Live Edit Decision:', {
      task,
      isWritingTask,
      hasTriggerPhrase,
      isStructuredContent,
      isReportRequest,
      isAnyWritingRequest,
      result,
      contentLength: content.length
    })

    return result
  }

  /**
   * Extract content for live editing
   */
  private extractContentForLiveEdit(content: string): string {
    console.log('🔍 RAG extractContentForLiveEdit:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + '...',
      hasHeaders: content.includes('#'),
      hasBullets: content.includes('- '),
      hasNumbers: content.includes('1.'),
      hasBold: content.includes('**'),
      hasTables: content.includes('|')
    })

    // Look for content after common phrases
    const patterns = [
      /I'll write[:\\s]*(.+)/i,
      /I'm writing[:\\s]*(.+)/i,
      /Let me write[:\\s]*(.+)/i,
      /Here's the[:\\s]*(.+)/i,
      /Here is the[:\\s]*(.+)/i,
      /I'll create[:\\s]*(.+)/i,
      /I'm creating[:\\s]*(.+)/i,
      /I'll add[:\\s]*(.+)/i,
      /I'm adding[:\\s]*(.+)/i,
      /Let me add[:\\s]*(.+)/i,
      /I'll insert[:\\s]*(.+)/i,
      /I'm inserting[:\\s]*(.+)/i,
      /Writing[:\\s]*(.+)/i,
      /Creating[:\\s]*(.+)/i,
      /Adding[:\\s]*(.+)/i,
      /I'll provide[:\\s]*(.+)/i,
      /I'm providing[:\\s]*(.+)/i,
      /Let me provide[:\\s]*(.+)/i,
      /Here's a[:\\s]*(.+)/i,
      /Here is a[:\\s]*(.+)/i,
      /I'll draft[:\\s]*(.+)/i,
      /I'm drafting[:\\s]*(.+)/i
    ]
    
    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        const extracted = match[1].trim()
        console.log('✅ Pattern matched, extracted:', extracted.substring(0, 100) + '...')
        return extracted
      }
    }
    
    // If no pattern matches, check if it's structured content (report/document)
    if (content.length > 500 && (
      content.includes('#') || 
      content.includes('##') || 
      content.includes('**') || 
      content.includes('1.') || 
      content.includes('- ') || 
      content.includes('|')
    )) {
      // For structured content, return the entire content
      console.log('✅ Structured content detected, returning full content')
      return content
    }
    
    // For any content longer than 100 characters, return it as-is
    // This ensures we don't lose content due to pattern matching issues
    if (content.length > 100) {
      console.log('✅ Long content detected, returning full content')
      return content
    }
    
    // If no pattern matches, return the content as-is
    console.log('⚠️ No pattern matched, returning content as-is')
    return content
  }
}

/**
 * Factory function to create orchestrator instance
 */
export function createRAGOrchestrator(options: RAGOrchestratorOptions): RAGOrchestrator {
  return new RAGOrchestrator(options)
}

/**
 * Quick process function for simple use cases
 */
export async function processRAGQuery(
  ask: string,
  userId: string,
  options: Partial<RAGOrchestratorOptions> = {}
): Promise<RAGResponse> {
  const orchestrator = createRAGOrchestrator({
    userId,
    ...options
  })

  return orchestrator.processQuery(ask)
}
