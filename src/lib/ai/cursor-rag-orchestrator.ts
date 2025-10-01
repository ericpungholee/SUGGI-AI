/**
 * Cursor RAG Orchestrator - Enhanced RAG system supporting the Cursor System Instruction
 * Implements the 5-document limit and current document scope policies
 */

import { ragAdapter, RagChunk, buildEvidenceBundle } from './rag-adapter'
import { routeQuery, RouterDecision } from './rag-router'
import { fillInstructionJSON, InstructionJSON, generateSystemPrompt } from './instruction-json'
import { verifyInstruction, VerificationResult, validateResponse } from './rag-verification'
import { generateChatCompletion } from './openai'
import { 
  RouterJSON, 
  InstructionJSON as CursorInstructionJSON, 
  EditorOpsJSON 
} from './cursor-system-instruction'

export interface CursorRAGOptions {
  userId: string
  documentId: string
  maxLinkedDocuments?: number
  maxTokens?: number
  enableWebSearch?: boolean
  webSearchTimeout?: number
  conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>
  linkedDocuments?: string[]
}

export interface CursorRAGResponse {
  content: string
  citations: string[]
  metadata: {
    task: string
    ragConfidence: number
    coverage: number
    totalTokens: number
    processingTime: number
    sourcesUsed: number
    currentDocumentUsed: boolean
    linkedDocumentsUsed: string[]
    shouldTriggerLiveEdit?: boolean
  }
  verification: VerificationResult
  liveEditContent?: string
}

/**
 * Enhanced RAG orchestrator implementing the Cursor System Instruction policies
 */
export class CursorRAGOrchestrator {
  private options: CursorRAGOptions
  private linkedDocuments: Set<string> = new Set()

  constructor(options: CursorRAGOptions) {
    this.options = {
      maxLinkedDocuments: 5,
      maxTokens: 2000,
      enableWebSearch: false,
      webSearchTimeout: 3500,
      linkedDocuments: [],
      ...options
    }
    
    // Initialize linked documents
    if (this.options.linkedDocuments) {
      this.options.linkedDocuments.forEach(docId => this.linkDocument(docId))
    }
  }

  /**
   * Process user query through RAG-first pipeline with Cursor System Instruction policies
   */
  async processQuery(
    ask: string,
    selection?: string,
    session?: any
  ): Promise<CursorRAGResponse> {
    const startTime = Date.now()
    
    try {
      // 1. Route the query
      const route = await routeQuery(ask, selection, session)

      // 2. Check if query is relevant to user's documents
      const isRelevantToDocuments = await this.isQueryRelevantToDocuments(ask, route)
      
      let ragHits: RagChunk[] = []
      let ragCtx: RagChunk[] = []
      let ragConf = 0
      let coverage = 0
      let currentDocumentUsed = false
      let linkedDocumentsUsed: string[] = []

      // 3. Only search RAG if query is relevant to documents
      if (isRelevantToDocuments) {
        // Search current document first
        const currentDocHits = await this.searchCurrentDocument(route.query.semantic)
        currentDocumentUsed = currentDocHits.length > 0
        
        // Search linked documents (up to 5)
        const linkedDocHits = await this.searchLinkedDocuments(route.query.semantic)
        linkedDocumentsUsed = [...new Set(linkedDocHits.map(hit => hit.docId))]
        
        // Combine results
        ragHits = [...currentDocHits, ...linkedDocHits]

        // Expand hierarchy and pack context
        ragCtx = await ragAdapter.packContext(
          await ragAdapter.expandHierarchy(ragHits, 1, true),
          this.options.maxTokens! * 0.7 // Use 70% of budget for RAG
        )
        
        ragConf = ragAdapter.confidence(ragHits)
        coverage = this.calculateCoverage(ragHits)
      }

      // 4. Decide if web search is needed
      const useWeb = this.shouldUseWeb(route, ragConf, coverage, isRelevantToDocuments)
      let webResults: any[] = []

      if (useWeb && this.options.enableWebSearch) {
        // Extract search terms from the user prompt, removing writing instructions
        const searchQuery = await this.extractSearchTerms(ask)
        webResults = await this.performWebSearch(searchQuery, this.options.webSearchTimeout!)
      }

      // 5. Build evidence bundle
      const evidence = buildEvidenceBundle(ragCtx, webResults)
      
      // 6. Calculate improved coverage including web results
      const improvedCoverage = this.calculateImprovedCoverage(ragCtx, webResults, route)
      
      // 7. Create instruction JSON
      const instruction = await fillInstructionJSON(
        route,
        ask,
        selection,
        ragCtx,
        webResults,
        ragConf,
        improvedCoverage
      )

      // 8. Verify instruction
      const verification = await verifyInstruction(instruction, evidence)

      // 9. Generate response
      const systemPrompt = generateSystemPrompt(instruction, evidence, verification)
      const response = await generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: ask }
      ], {
        model: 'gpt-5-2025-08-07',
        temperature: 0.1,
        max_tokens: this.options.maxTokens
      })

      const content = response.choices[0]?.message?.content || ''

      // 9. Validate response
      const validation = await validateResponse(content, instruction, evidence)

      // 10. Extract citations
      const citations = this.extractCitations(content, ragCtx, webResults)

      // 11. Check if should trigger live edit
      const shouldTriggerLiveEdit = this.shouldTriggerLiveEdit(route, ragConf, coverage)

      const processingTime = Date.now() - startTime

      return {
        content,
        citations,
        metadata: {
          task: route.task,
          ragConfidence: ragConf,
          coverage: improvedCoverage,
          totalTokens: this.estimateTokens(content),
          processingTime,
          sourcesUsed: ragCtx.length + webResults.length,
          currentDocumentUsed,
          linkedDocumentsUsed,
          shouldTriggerLiveEdit
        },
        verification,
        liveEditContent: shouldTriggerLiveEdit ? content : undefined
      }

    } catch (error) {
      console.error('Cursor RAG Orchestrator error:', error)
      throw new Error(`RAG processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search current document only
   */
  private async searchCurrentDocument(query: string): Promise<RagChunk[]> {
    try {
      const results = await ragAdapter.search(query, {
        topK: 15,
        projectId: this.options.userId
      })
      
      // Filter to only current document
      return results.filter(chunk => chunk.docId === this.options.documentId)
    } catch (error) {
      console.error('Current document search error:', error)
      return []
    }
  }

  /**
   * Search linked documents only (up to 5)
   */
  private async searchLinkedDocuments(query: string): Promise<RagChunk[]> {
    if (this.linkedDocuments.size === 0) {
      return []
    }

    try {
      const results = await ragAdapter.search(query, {
        topK: 15,
        projectId: this.options.userId
      })
      
      // Filter to only linked documents
      return results.filter(chunk => this.linkedDocuments.has(chunk.docId))
    } catch (error) {
      console.error('Linked documents search error:', error)
      return []
    }
  }

  /**
   * Check if query is relevant to user's documents
   */
  private async isQueryRelevantToDocuments(ask: string, route: RouterDecision): Promise<boolean> {
    // Skip relevance check for certain task types that should always use web search
    if (route.needs.web_context === 'required') {
      return false
    }

    // Check if query is asking for current information that wouldn't be in documents
    const currentInfoKeywords = [
      'current', 'latest', 'recent', 'today', 'now', '2024', '2025',
      'news', 'stock', 'price', 'market', 'financial', 'earnings',
      'weather', 'time', 'date', 'live', 'real-time', 'real data'
    ]
    
    const lowerQuery = ask.toLowerCase()
    const hasCurrentInfoKeywords = currentInfoKeywords.some(keyword => lowerQuery.includes(keyword))
    
    if (hasCurrentInfoKeywords) {
      return false
    }

    // Check for document-specific editing tasks
    const documentEditingKeywords = [
      'edit this', 'rewrite this', 'modify this', 'change this',
      'in this document', 'in my document', 'in the document',
      'this paragraph', 'this section', 'this text'
    ]
    
    const hasDocumentEditingKeywords = documentEditingKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    )
    
    if (hasDocumentEditingKeywords) {
      return true
    }
    
    // Check for content about personal documents
    const personalContentKeywords = [
      'my notes', 'my document', 'my file', 'my content',
      'what did i write', 'what i wrote', 'my analysis',
      'document', 'section', 'paragraph', 'heading', 'chapter'
    ]
    
    const hasPersonalContentKeywords = personalContentKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    )
    
    if (hasPersonalContentKeywords) {
      return true
    }

    // For general writing tasks without specific document context, use web search
    const generalWritingKeywords = [
      'write', 'create', 'generate', 'compose', 'draft',
      'analysis', 'report', 'article', 'story', 'essay'
    ]
    
    const hasGeneralWritingKeywords = generalWritingKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    )
    
    // If it's general writing without document context, don't use RAG
    if (hasGeneralWritingKeywords) {
      return false
    }
    
    // Default to false for other queries
    return false
  }

  /**
   * Calculate coverage of retrieved chunks
   */
  private calculateCoverage(chunks: RagChunk[]): number {
    if (chunks.length === 0) return 0
    
    const totalScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0)
    const avgScore = totalScore / chunks.length
    
    // Normalize to 0-1 range
    return Math.min(avgScore * 2, 1)
  }

  /**
   * Calculate improved coverage including web results and task-specific adjustments
   */
  private calculateImprovedCoverage(ragChunks: RagChunk[], webResults: any[], route: RouterDecision): number {
    // Base coverage from RAG chunks
    const ragCoverage = this.calculateCoverage(ragChunks)
    
    // Web search contribution (each web result adds 0.1 coverage, max 0.5)
    const webCoverage = Math.min(0.5, webResults.length * 0.1)
    
    // Task-specific adjustments
    const isWritingTask = route.task === 'write' || ['create', 'generate', 'compose', 'draft', 'report', 'document'].some(task => 
      route.task.toLowerCase().includes(task)
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
   * Decide if web search is needed
   */
  private shouldUseWeb(
    route: RouterDecision, 
    ragConf: number, 
    coverage: number, 
    isRelevantToDocuments: boolean
  ): boolean {
    // Don't use web if RAG has good coverage
    if (ragConf > 0.7 && coverage > 0.6) {
      return false
    }
    
    // Use web for current events, statistics, or external facts
    const needsWebKeywords = [
      'current', 'latest', 'recent', 'today', 'this year', 'statistics',
      'data', 'research', 'study', 'news', 'update'
    ]
    
    const needsWeb = needsWebKeywords.some(keyword => 
      route.query.semantic.toLowerCase().includes(keyword)
    )
    
    return needsWeb || (!isRelevantToDocuments && ragConf < 0.3)
  }

  /**
   * Extract search terms from user prompt
   */
  private async extractSearchTerms(ask: string): Promise<string> {
    // Remove writing instructions and focus on factual content
    const writingInstructions = [
      'write', 'edit', 'rewrite', 'summarize', 'extend', 'outline',
      'critique', 'format', 'style', 'make it', 'change it'
    ]
    
    let searchQuery = ask
    
    // Remove writing instructions
    writingInstructions.forEach(instruction => {
      const regex = new RegExp(`\\b${instruction}\\b[^.]*`, 'gi')
      searchQuery = searchQuery.replace(regex, '').trim()
    })
    
    // Clean up extra spaces and punctuation
    searchQuery = searchQuery.replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '')
    
    return searchQuery || ask
  }

  /**
   * Perform web search
   */
  private async performWebSearch(query: string, timeout: number): Promise<any[]> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Web search failed: ${response.status}`)
      }
      
      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error('Web search error:', error)
      return []
    }
  }

  /**
   * Extract citations from content
   */
  private extractCitations(content: string, ragChunks: RagChunk[], webResults: any[]): string[] {
    const citations: string[] = []
    
    // Extract RAG citations
    ragChunks.forEach(chunk => {
      if (content.includes(chunk.text.substring(0, 50))) {
        citations.push(`Document: ${chunk.docId}`)
      }
    })
    
    // Extract web citations
    webResults.forEach(result => {
      if (result.url && content.includes(result.title)) {
        citations.push(`Web: ${result.url}`)
      }
    })
    
    return [...new Set(citations)] // Remove duplicates
  }

  /**
   * Check if should trigger live edit
   */
  private shouldTriggerLiveEdit(route: RouterDecision, ragConf: number, coverage: number): boolean {
    const editingTasks = ['rewrite', 'extend', 'format', 'style']
    return editingTasks.includes(route.task) && ragConf > 0.5 && coverage > 0.4
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  // ============================================================================
  // DOCUMENT MANAGEMENT METHODS
  // ============================================================================

  /**
   * Link a document for RAG retrieval (up to 5 documents max)
   */
  linkDocument(documentId: string): boolean {
    if (this.linkedDocuments.size >= this.options.maxLinkedDocuments!) {
      return false
    }
    this.linkedDocuments.add(documentId)
    return true
  }

  /**
   * Unlink a document
   */
  unlinkDocument(documentId: string): boolean {
    return this.linkedDocuments.delete(documentId)
  }

  /**
   * Get currently linked documents
   */
  getLinkedDocuments(): string[] {
    return Array.from(this.linkedDocuments)
  }

  /**
   * Check if a document is eligible for RAG retrieval
   */
  isDocumentEligible(documentId: string): boolean {
    return documentId === this.options.documentId || this.linkedDocuments.has(documentId)
  }

  /**
   * Update conversation history
   */
  updateConversationHistory(history: Array<{role: 'user' | 'assistant', content: string}>): void {
    this.options.conversationHistory = history
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCursorRAGOrchestrator(options: CursorRAGOptions): CursorRAGOrchestrator {
  return new CursorRAGOrchestrator(options)
}
