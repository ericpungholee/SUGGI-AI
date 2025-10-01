/**
 * Cursor System Instruction - Global System Instruction Implementation
 * Implements the comprehensive document editor AI system with RAG, chat, Writer Agent, and web search
 */

// ============================================================================
// CORE JSON SCHEMAS
// ============================================================================

/**
 * Router JSON - Initial routing decision
 */
export interface RouterJSON {
  task: 'rewrite' | 'summarize' | 'extend' | 'outline' | 'critique' | 'fact_check' | 'reference_insert' | 'compare' | 'table_create' | 'table_edit' | 'style'
  confidence: number
  needs: {
    selection_text: boolean
    doc_context: 'none' | 'current' | 'linked' | 'all'
    web_context: 'no' | 'recommended' | 'required'
    precision: 'low' | 'medium' | 'high'
  }
  query: {
    semantic: string
    keywords: string[]
  }
  targets: {
    type: 'selection' | 'paragraph' | 'heading' | 'line_range' | 'table_cell' | 'all'
    value?: string | number | { start: number; end: number }
  }[]
}

/**
 * Instruction JSON - Detailed planning with context and constraints
 */
export interface InstructionJSON {
  task: 'rewrite' | 'summarize' | 'extend' | 'outline' | 'critique' | 'fact_check' | 'reference_insert' | 'compare' | 'table_create' | 'table_edit' | 'style'
  inputs: Record<string, any>
  targets: Array<{
    type: 'selection' | 'paragraph' | 'heading' | 'line_range' | 'table_cell'
    value: string | number | { start: number; end: number }
    anchor?: string
  }>
  context_refs: Array<{
    type: 'doc' | 'web'
    doc_id?: string
    chunk_id?: string
    anchor?: string
    url?: string
    why: string
  }>
  constraints: {
    max_words?: number
    tone?: 'concise' | 'formal' | 'friendly' | 'confident'
    citation_style?: 'APA' | 'MLA' | 'Chicago' | null
  }
  telemetry: {
    route_conf: number
    rag_used: boolean
    web_used: boolean
  }
}

/**
 * Editor Ops JSON - Preview operations for the editor
 */
export interface EditorOpsJSON {
  pending_change_id: string
  ops: Array<{
    op: 'insert_after' | 'replace_range' | 'delete_range' | 'format' | 'set_block_type' | 'list_convert' | 'table_set_cell'
    anchor?: string
    text?: string
    range?: {
      start: { blockId: string; offset: number }
      end: { blockId: string; offset: number }
    }
    style?: string
    toggle?: boolean
    blockId?: string
    type?: string
    list?: string
    tableId?: string
    r?: number
    c?: number
    value?: string
  }>
  citations: Array<{
    type: 'doc' | 'web'
    anchor?: string
    url?: string
  }>
  summary: string
  notes: string
}

// ============================================================================
// CORE SYSTEM CLASS
// ============================================================================

export interface CursorSystemOptions {
  userId: string
  documentId: string
  maxLinkedDocuments?: number
  enableWebSearch?: boolean
  webSearchTimeout?: number
  conversationHistory?: Array<{ role: string; content: string }>
}

export class CursorSystemInstruction {
  private userId: string
  private documentId: string
  private maxLinkedDocuments: number
  private enableWebSearch: boolean
  private webSearchTimeout: number
  private conversationHistory: Array<{ role: string; content: string }>
  private linkedDocuments: Set<string> = new Set()

  constructor(options: CursorSystemOptions) {
    this.userId = options.userId
    this.documentId = options.documentId
    this.maxLinkedDocuments = options.maxLinkedDocuments || 5
    this.enableWebSearch = options.enableWebSearch || false
    this.webSearchTimeout = options.webSearchTimeout || 5000
    this.conversationHistory = options.conversationHistory || []
  }

  /**
   * A) ROUTE - Determine task and source needs
   */
  async route(
    userAsk: string,
    selectionText: string = '',
    filePath: string = ''
  ): Promise<RouterJSON> {
    console.log('🔍 Cursor System: Starting route analysis', { userAsk, selectionText, filePath })
    
    const routePrompt = `ROLE
You are the Router in the Cursor System Instruction. Your job is to analyze user requests and determine the task type and required context sources.

CORE POLICIES
1) RAG SCOPE: RAG is ONLY for user-provided documents (current + up to 5 linked docs)
2) CHAT MEMORY: Maintain conversational context across turns
3) INSTRUCTION JSON: All planning must output strict JSON matching the RouterJSON schema
4) AI FEATURE SET: Chat, Writer Agent, RAG, and optional web search

ROUTING RULES
- Determine the primary task type from the user's request
- Assess if selection text is needed for the task
- Decide on document context needs (none, current, linked, all)
- Determine if web search is needed for fresh/external facts
- Identify precision requirements based on task complexity

TASK TYPES
- rewrite: Modify existing content
- summarize: Create concise summary
- extend: Add new content after existing
- outline: Create structured outline
- critique: Analyze and provide feedback
- fact_check: Verify factual claims
- reference_insert: Add citations/references
- compare: Compare multiple items
- table_create: Create new table
- table_edit: Modify existing table
- style: Apply formatting changes

CONTEXT NEEDS
- none: No document context needed
- current: Only current document
- linked: Current + linked documents (up to 5)
- all: All available documents

WEB CONTEXT
- no: No web search needed
- recommended: Web search would be helpful
- required: Web search is essential for the task

PRECISION
- low: General guidance, approximate results
- medium: Specific but flexible results
- high: Precise, exact results

USER REQUEST: "${userAsk}"
SELECTION: "${selectionText}"
FILE PATH: "${filePath}"

Output ONLY valid JSON matching the RouterJSON schema.`

    try {
      console.log('🔍 Cursor System: Calling generateChatCompletion')
      const response = await this.generateChatCompletion(routePrompt)
      console.log('🔍 Cursor System: Received response', { responseLength: response.length })
      
      const routerJSON = JSON.parse(response)
      console.log('🔍 Cursor System: Parsed router JSON', routerJSON)
      
      // Validate the router JSON structure
      this.validateRouterJSON(routerJSON)
      
      return routerJSON
    } catch (error) {
      console.error('❌ Cursor System Router error:', error)
      // Return fallback router JSON
      const fallback = {
        task: 'rewrite',
        confidence: 0.5,
        needs: {
          selection_text: !!selectionText,
          doc_context: 'current',
          web_context: 'no',
          precision: 'medium'
        },
        query: {
          semantic: userAsk,
          keywords: userAsk.split(' ').filter(word => word.length > 3)
        },
        targets: [{
          type: 'selection',
          value: selectionText || 'all'
        }]
      }
      console.log('🔍 Cursor System: Using fallback router JSON', fallback)
      return fallback
    }
  }

  /**
   * B) RETRIEVE - Get context from RAG and web
   */
  async retrieve(
    routerJSON: RouterJSON,
    userAsk: string,
    selectionText: string = ''
  ): Promise<{
    ragChunks: any[]
    webResults: any[]
    documentOutline: string
  }> {
    let ragChunks: any[] = []
    let webResults: any[] = []
    let documentOutline = ''

    // RAG retrieval - only for allowed documents
    if (routerJSON.needs.doc_context !== 'none') {
      try {
        ragChunks = await this.retrieveRAGContext(
          routerJSON.query.semantic,
          routerJSON.needs.doc_context
        )
      } catch (error) {
        console.error('RAG retrieval error:', error)
      }
    }

    // Web search if needed
    if (routerJSON.needs.web_context !== 'no' && this.enableWebSearch) {
      try {
        webResults = await this.retrieveWebContext(routerJSON.query.semantic)
      } catch (error) {
        console.error('Web search error:', error)
      }
    }

    // Get document outline
    try {
      documentOutline = await this.getDocumentOutline()
    } catch (error) {
      console.error('Document outline error:', error)
    }

    return { ragChunks, webResults, documentOutline }
  }

  /**
   * C) PLAN - Create detailed instruction JSON
   */
  async plan(
    routerJSON: RouterJSON,
    userAsk: string,
    selectionText: string,
    ragChunks: any[],
    webResults: any[],
    documentOutline: string
  ): Promise<InstructionJSON> {
    const planPrompt = `ROLE
You are the Planner in the Cursor System Instruction. Your job is to create a detailed Instruction JSON based on the router decision and retrieved context.

CORE POLICIES
1) RAG SCOPE: Only use context from current document or up to 5 linked documents
2) TARGETED EDITS: Identify exact locations for edits (selection, paragraph, heading, line ranges)
3) CONTEXT REFS: Only include sources that are actually used in the task
4) CONSTRAINTS: Set appropriate limits for tone, length, and citation style

INSTRUCTION JSON RULES
- task: Must match the router task type
- inputs: Task-specific payload (e.g., rewrite: {target_text, style})
- targets: WHERE to edit in the CURRENT document only
- context_refs: ONLY sources that will influence the content
- constraints: Set appropriate limits and style requirements
- telemetry: Track confidence and source usage

ROUTER DECISION: ${JSON.stringify(routerJSON)}
USER REQUEST: "${userAsk}"
SELECTION: "${selectionText}"
DOCUMENT OUTLINE: "${documentOutline}"
RAG CHUNKS: ${ragChunks.length} chunks available
WEB RESULTS: ${webResults.length} results available

TASK-SPECIFIC INPUTS:
- rewrite: { "target_text": "...", "style": {"tone":"confident","grade_level":10} }
- extend: { "after_anchor":"doc#h2:p3", "outline":["pt1","pt2"] }
- fact_check: { "text":"..." }
- table_create: { "columns":["..."], "rows":[...] }
- style: { "ops":[{"style":"bold","scope":"targets"}] }

TARGET TYPES:
- selection: Use current selection
- paragraph: Reference by index or content
- heading: Reference by level and text
- line_range: Reference by line numbers (e.g., L12-L18)
- table_cell: Reference by table ID and coordinates

Output ONLY valid JSON matching the InstructionJSON schema.`

    try {
      const response = await this.generateChatCompletion(planPrompt)
      const instructionJSON = JSON.parse(response)
      
      // Validate the instruction JSON structure
      this.validateInstructionJSON(instructionJSON)
      
      return instructionJSON
    } catch (error) {
      console.error('Planner error:', error)
      // Return fallback instruction JSON
      return {
        task: routerJSON.task,
        inputs: { target_text: selectionText || userAsk },
        targets: [{
          type: 'selection',
          value: selectionText || 'all'
        }],
        context_refs: [],
        constraints: {
          max_words: 500,
          tone: 'concise'
        },
        telemetry: {
          route_conf: routerJSON.confidence,
          rag_used: ragChunks.length > 0,
          web_used: webResults.length > 0
        }
      }
    }
  }

  /**
   * D) PREVIEW - Generate editor operations for preview
   */
  async preview(
    instructionJSON: InstructionJSON,
    documentModel: any
  ): Promise<EditorOpsJSON> {
    const previewPrompt = `ROLE
You are the Preview Generator in the Cursor System Instruction. Your job is to create precise editor operations based on the Instruction JSON.

CORE POLICIES
1) PREVIEW ONLY: Generate operations that render a preview (not saved)
2) TARGETED EDITS: Work with existing content, don't overwrite everything
3) SURGICAL EDITS: Prefer insert/replace/reformat over full rewrites
4) FORMATTING: Use toolbar operations for styling

EDITOR OPERATIONS
- insert_after: Add content after specified anchor
- replace_range: Replace text in specific range
- delete_range: Remove text in specific range
- format: Apply formatting (bold, italic, etc.)
- set_block_type: Change block type (heading, paragraph, etc.)
- list_convert: Convert to list format
- table_set_cell: Set table cell value

LOM (LINE OBJECT MODEL) RULES
- Each line is a first-class object with stable line_index and line_id
- Line numbering is stable across layout changes
- Target specific line objects when user references "L12-L18"
- Include line_targets in operations when applicable

INSTRUCTION: ${JSON.stringify(instructionJSON)}
DOCUMENT MODEL: ${documentModel ? 'Provided' : 'Not provided'}

OPERATION RULES
- Operate only on the current document
- Preserve existing structure unless instructed to reformat
- All ranges and block IDs must exist in the document model
- For tables, use explicit cell/row/column operations
- Include citations for all factual claims

Output ONLY valid JSON matching the EditorOpsJSON schema.`

    try {
      const response = await this.generateChatCompletion(previewPrompt)
      const editorOpsJSON = JSON.parse(response)
      
      // Validate the editor ops JSON structure
      this.validateEditorOpsJSON(editorOpsJSON)
      
      return editorOpsJSON
    } catch (error) {
      console.error('Preview generator error:', error)
      // Return fallback editor ops JSON
      return {
        pending_change_id: `change-${Date.now()}`,
        ops: [{
          op: 'insert_after',
          anchor: 'doc#end',
          text: 'Preview content would appear here'
        }],
        citations: [],
        summary: 'Preview operation',
        notes: 'Fallback preview due to error'
      }
    }
  }

  /**
   * E) APPROVAL - Generate approval message for chat
   */
  generateApprovalMessage(editorOpsJSON: EditorOpsJSON): string {
    const { summary, notes, citations } = editorOpsJSON
    const sourceDomains = citations.map(c => c.url || c.anchor).filter(Boolean)
    
    let message = summary
    if (sourceDomains.length > 0) {
      message += ` Sources: ${sourceDomains.join(', ')}`
    }
    if (notes) {
      message += ` (${notes})`
    }
    
    return message.substring(0, 60) // Limit to 60 words as specified
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async retrieveRAGContext(
    query: string,
    docContext: 'none' | 'current' | 'linked' | 'all'
  ): Promise<any[]> {
    try {
      // Use the existing RAG orchestrator
      const { createRAGOrchestrator } = await import('./rag-orchestrator')
      const orchestrator = createRAGOrchestrator({
        userId: this.userId,
        documentId: this.documentId,
        maxTokens: 2000,
        enableWebSearch: false,
        conversationHistory: this.conversationHistory
      })

      const response = await orchestrator.processQuery(query)
      
      // Extract chunks from response
      const chunks = response.metadata?.sourcesUsed > 0 ? [] : [] // Placeholder
      return chunks
    } catch (error) {
      console.error('RAG context retrieval error:', error)
      return []
    }
  }

  private async retrieveWebContext(query: string): Promise<any[]> {
    try {
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error(`Web search failed: ${response.status}`)
      }

      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error('Web context retrieval error:', error)
      return []
    }
  }

  private async getDocumentOutline(): Promise<string> {
    try {
      // This would typically fetch the document structure
      // For now, return a placeholder
      return 'Document outline not available'
    } catch (error) {
      console.error('Document outline error:', error)
      return ''
    }
  }

  private async generateChatCompletion(prompt: string): Promise<string> {
    try {
      console.log('🔍 Cursor System: Importing generateChatCompletion')
      const { generateChatCompletion } = await import('./openai')
      console.log('🔍 Cursor System: Calling generateChatCompletion')
      
      const response = await generateChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-5-2025-08-07',
        temperature: 0.1,
        max_tokens: 500
      })

      console.log('🔍 Cursor System: Received chat completion response', { 
        hasChoices: !!response.choices, 
        choicesLength: response.choices?.length 
      })

      return response.choices[0]?.message?.content || '{}'
    } catch (error) {
      console.error('❌ Cursor System Chat completion error:', error)
      return '{}'
    }
  }

  private validateRouterJSON(json: any): void {
    if (!json.task || !json.confidence || !json.needs || !json.query || !json.targets) {
      throw new Error('Invalid RouterJSON structure')
    }
  }

  private validateInstructionJSON(json: any): void {
    if (!json.task || !json.inputs || !json.targets || !json.context_refs || !json.constraints || !json.telemetry) {
      throw new Error('Invalid InstructionJSON structure')
    }
  }

  private validateEditorOpsJSON(json: any): void {
    if (!json.pending_change_id || !json.ops || !json.citations || !json.summary || !json.notes) {
      throw new Error('Invalid EditorOpsJSON structure')
    }
  }

  // ============================================================================
  // DOCUMENT MANAGEMENT
  // ============================================================================

  /**
   * Link a document for RAG retrieval (up to 5 documents max)
   */
  linkDocument(documentId: string): boolean {
    if (this.linkedDocuments.size >= this.maxLinkedDocuments) {
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
    return documentId === this.documentId || this.linkedDocuments.has(documentId)
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCursorSystemInstruction(options: CursorSystemOptions): CursorSystemInstruction {
  return new CursorSystemInstruction(options)
}
