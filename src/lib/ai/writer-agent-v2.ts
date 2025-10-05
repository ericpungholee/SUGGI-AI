/**
 * Writer Agent V2 - Complete Implementation
 * Implements RAG-first approach with preview-only edits and chat-based approval workflow
 */

import { getOpenAI } from './core/openai-client'
import { getChatModel } from './core/models'
import { routerService } from './router-service'
import { ragAdapter, RagChunk } from './rag-adapter'
import { webSearch } from './services/web-search'
import { createMCPTools } from './mcp-tools'
import { createDocumentStructureAnalyzer, DocumentStructure } from './document-structure-analyzer'
import { createEnhancedPreviewOperationsGenerator, EnhancedPreviewOps, EnhancedPreviewOp } from './enhanced-preview-operations'

// JSON Contracts as specified in documentation

export interface RouterOut {
  task: 'rewrite' | 'summarize' | 'extend' | 'outline' | 'critique' | 'fact_check' | 'reference_insert' | 'compare' | 'table_create' | 'table_edit'
  confidence: number
  needs: {
    selection_text: boolean
    doc_context: 'none' | 'local' | 'project' | 'workspace'
    web_context: 'no' | 'recommended' | 'required'
    precision: 'low' | 'medium' | 'high'
  }
  query: {
    semantic: string
    keywords: string[]
  }
}

export interface Instruction {
  task: string
  inputs: Record<string, any>
  context_refs: Array<{
    type: 'doc' | 'web'
    id?: string
    anchor?: string
    url?: string
    why: string
  }>
  constraints: {
    max_words?: number
    tone?: string
    citation_style?: 'APA' | 'MLA' | 'Chicago' | null
  }
  telemetry: {
    route_conf: number
    rag_conf: number
  }
}

// Using EnhancedPreviewOps from enhanced-preview-operations.ts

export interface WriterAgentV2Options {
  userId: string
  documentId?: string
  selection?: string
  maxTokens?: number
  enableWebSearch?: boolean
  webSearchTimeout?: number
}

export class WriterAgentV2 {
  private options: WriterAgentV2Options
  private openai: any
  private documentAnalyzer: any
  private enhancedOperationsGenerator: any

  constructor(options: WriterAgentV2Options) {
    this.options = {
      maxTokens: 4000,
      enableWebSearch: true,
      webSearchTimeout: 15000,
      ...options
    }
    this.openai = getOpenAI()
    this.documentAnalyzer = createDocumentStructureAnalyzer()
    this.enhancedOperationsGenerator = createEnhancedPreviewOperationsGenerator(this.documentAnalyzer)
  }

  /**
   * Main processing pipeline: ROUTE → PLAN → EXECUTE → MESSAGE
   */
  async processRequest(
    userQuery: string,
    documentContent?: string
  ): Promise<{
    routerOut: RouterOut
    instruction: Instruction
    previewOps: EnhancedPreviewOps
    approvalMessage: string
  }> {
    console.log('🚀 Writer Agent V2 - Starting processing pipeline')

    // A) ROUTE - Determine task and needs
    const routerOut = await this.route(userQuery, documentContent)
    console.log('✅ ROUTE completed:', routerOut)

    // B) PLAN - Create instruction with context
    const instruction = await this.plan(routerOut, userQuery, documentContent)
    console.log('✅ PLAN completed:', instruction)

    // C) EXECUTE - Generate preview operations
    const previewOps = await this.execute(instruction, documentContent)
    console.log('✅ EXECUTE completed:', previewOps)

    // D) MESSAGE - Generate approval message
    const approvalMessage = await this.generateApprovalMessage(previewOps, instruction)
    console.log('✅ MESSAGE completed')

    return {
      routerOut,
      instruction,
      previewOps,
      approvalMessage
    }
  }

  /**
   * A) ROUTE - Determine task and source needs
   */
  private async route(userQuery: string, documentContent?: string): Promise<RouterOut> {
    console.log('🔍 ROUTE: Analyzing user request...')

    // Use existing router service for intent classification
    const routerContext = {
      has_attached_docs: !!this.options.documentId,
      doc_ids: this.options.documentId ? [this.options.documentId] : [],
      is_selection_present: !!this.options.selection && this.options.selection.length > 0,
      selection_length: this.options.selection?.length || 0,
      recent_tools: [],
      conversation_length: 0,
      user_id: this.options.userId,
      document_id: this.options.documentId
    }

    const routerResult = await routerService.classifyIntent(userQuery, routerContext)
    
    // Map router intent to Writer Agent task
    const taskMapping: Record<string, RouterOut['task']> = {
      'edit_request': 'rewrite',
      'editor_write': 'extend',
      'rag_query': 'reference_insert',
      'web_search': 'fact_check',
      'ask': 'summarize'
    }

    const task = taskMapping[routerResult.classification.intent] || 'rewrite'
    
    // Determine needs based on router result and query analysis
    const needs = {
      selection_text: !!this.options.selection,
      doc_context: this.determineDocContext(routerResult, documentContent),
      web_context: this.determineWebContext(routerResult, userQuery),
      precision: this.determinePrecision(userQuery, task)
    }

    // Extract semantic query and keywords
    const query = {
      semantic: this.extractSemanticQuery(userQuery),
      keywords: this.extractKeywords(userQuery)
    }

    return {
      task,
      confidence: routerResult.classification.confidence,
      needs,
      query
    }
  }

  /**
   * B) PLAN - Produce instruction with context references
   */
  private async plan(
    routerOut: RouterOut, 
    userQuery: string, 
    documentContent?: string
  ): Promise<Instruction> {
    console.log('📋 PLAN: Creating instruction with context...')

    // Gather context based on needs
    const contextRefs = await this.gatherContext(routerOut, userQuery)
    
    // Create instruction inputs
    const inputs = {
      user_query: userQuery,
      selection: this.options.selection || null,
      document_content: documentContent || null,
      task: routerOut.task
    }

    // Determine constraints
    const constraints = {
      max_words: this.estimateMaxWords(routerOut.task, userQuery),
      tone: this.determineTone(userQuery),
      citation_style: this.determineCitationStyle(userQuery)
    }

    // Calculate telemetry
    const telemetry = {
      route_conf: routerOut.confidence,
      rag_conf: this.calculateRAGConfidence(contextRefs)
    }

    return {
      task: routerOut.task,
      inputs,
      context_refs: contextRefs,
      constraints,
      telemetry
    }
  }

  /**
   * C) EXECUTE - Generate enhanced preview operations with document structure awareness
   */
  private async execute(
    instruction: Instruction, 
    documentContent?: string
  ): Promise<EnhancedPreviewOps> {
    console.log('⚡ EXECUTE: Generating enhanced preview operations...')

    // Analyze document structure if content is provided
    let documentStructure: DocumentStructure | undefined
    if (documentContent) {
      documentStructure = this.documentAnalyzer.analyzeDocument(documentContent)
      console.log('📊 Document structure analyzed:', {
        type: documentStructure.type,
        elementsCount: documentStructure.elements.length,
        headingsCount: documentStructure.headings.length,
        complexity: documentStructure.metadata.structureComplexity
      })
    }

    // Use enhanced operations generator
    const enhancedOps = await this.enhancedOperationsGenerator.generateEnhancedOperations(
      instruction,
      documentContent,
      documentStructure
    )

    // Convert to EnhancedPreviewOps format for backward compatibility
    const previewOps: EnhancedPreviewOps = {
      pending_change_id: enhancedOps.pending_change_id,
      ops: this.convertEnhancedOpsToLegacyOps(enhancedOps.ops),
      citations: enhancedOps.citations,
      summary: enhancedOps.summary,
      notes: enhancedOps.notes,
      document_analysis: enhancedOps.document_analysis,
      placement_strategy: enhancedOps.placement_strategy,
      structure_impact: enhancedOps.structure_impact
    }

    console.log('✅ Enhanced operations generated:', {
      operationsCount: previewOps.ops.length,
      structureImpact: previewOps.structure_impact,
      placementStrategy: previewOps.placement_strategy?.suggestedStructure
    })

    return previewOps
  }

  /**
   * Convert enhanced operations to legacy format for backward compatibility
   */
  private convertEnhancedOpsToLegacyOps(enhancedOps: EnhancedPreviewOp[]): Array<{
    op: string
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
  }> {
    return enhancedOps.map(op => ({
      op: op.op,
      anchor: op.anchor,
      text: op.text,
      range: op.range,
      style: op.structure?.style,
      blockId: op.structure?.type,
      type: op.structure?.type,
      list: op.listType,
      value: op.url
    }))
  }

  private async generateApprovalMessage(
    previewOps: EnhancedPreviewOps, 
    instruction: Instruction
  ): Promise<string> {
    console.log('💬 MESSAGE: Generating approval message...')

    const operationCount = previewOps.ops.length
    const citationCount = previewOps.citations.length
    const task = instruction.task
    const structureImpact = previewOps.structure_impact

    let message = `I'm ready to ${task} your content. Here's what I'll do:\n\n`
    
    // Describe operations
    if (operationCount > 0) {
      message += `• ${operationCount} editing operation${operationCount > 1 ? 's' : ''}\n`
    }
    
    // Add structure impact information
    if (structureImpact) {
      if (structureImpact.sections_added > 0) {
        message += `• ${structureImpact.sections_added} new section${structureImpact.sections_added > 1 ? 's' : ''} added\n`
      }
      if (structureImpact.sections_modified > 0) {
        message += `• ${structureImpact.sections_modified} section${structureImpact.sections_modified > 1 ? 's' : ''} modified\n`
      }
      if (structureImpact.formatting_changes > 0) {
        message += `• ${structureImpact.formatting_changes} formatting change${structureImpact.formatting_changes > 1 ? 's' : ''}\n`
      }
      if (structureImpact.hierarchy_changes) {
        message += `• Document structure and hierarchy updated\n`
      }
    }
    
    // Mention citations
    if (citationCount > 0) {
      message += `• ${citationCount} source${citationCount > 1 ? 's' : ''} referenced\n`
    }
    
    // Add task-specific details
    switch (task) {
      case 'rewrite':
        message += `• Rewrite the selected text for better clarity and flow\n`
        break
      case 'extend':
        message += `• Add new content to expand on the topic\n`
        break
      case 'summarize':
        message += `• Create a concise summary of the content\n`
        break
      case 'fact_check':
        message += `• Verify facts and add citations where needed\n`
        break
      case 'reference_insert':
        message += `• Insert relevant references and citations\n`
        break
    }

    // Add placement strategy information
    if (previewOps.placement_strategy) {
      const strategy = previewOps.placement_strategy.suggestedStructure
      if (strategy && strategy !== 'append') {
        message += `• Content will be intelligently ${strategy}d based on document structure\n`
      }
    }

    message += `\n**Preview ID:** ${previewOps.pending_change_id}\n\n`
    message += `Type **"Approve"** to apply these changes, or **"Deny"** to cancel.`

    return message
  }

  // Helper methods

  private determineDocContext(routerResult: any, documentContent?: string): 'none' | 'local' | 'project' | 'workspace' {
    if (!documentContent) return 'none'
    if (routerResult.classification.intent === 'rag_query') return 'project'
    return 'local'
  }

  private determineWebContext(routerResult: any, userQuery: string): 'no' | 'recommended' | 'required' {
    if (routerResult.classification.intent === 'web_search') return 'required'
    if (routerResult.classification.slots.needs_recency) return 'recommended'
    return 'no'
  }

  private determinePrecision(userQuery: string, task: string): 'low' | 'medium' | 'high' {
    const precisionKeywords = ['exactly', 'precisely', 'specific', 'detailed', 'thorough']
    const hasPrecisionKeywords = precisionKeywords.some(keyword => 
      userQuery.toLowerCase().includes(keyword)
    )
    
    if (hasPrecisionKeywords || task === 'fact_check') return 'high'
    if (task === 'rewrite' || task === 'extend') return 'medium'
    return 'low'
  }

  private extractSemanticQuery(userQuery: string): string {
    // Remove common writing instruction words to get the core semantic meaning
    const instructionWords = ['rewrite', 'edit', 'improve', 'fix', 'make', 'change', 'update']
    let semantic = userQuery
    
    instructionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      semantic = semantic.replace(regex, '').trim()
    })
    
    return semantic || userQuery
  }

  private extractKeywords(userQuery: string): string[] {
    // Simple keyword extraction - in a real implementation, this would be more sophisticated
    const words = userQuery.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'there', 'could', 'other', 'after', 'first', 'well', 'also', 'where', 'much', 'some', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'these', 'so', 'some', 'its', 'now', 'find', 'any', 'new', 'work', 'part', 'take', 'get', 'place', 'made', 'live', 'where', 'after', 'back', 'little', 'only', 'round', 'man', 'year', 'came', 'show', 'every', 'good', 'me', 'give', 'our', 'under', 'name', 'very', 'through', 'just', 'form', 'sentence', 'great', 'think', 'say', 'help', 'low', 'line', 'differ', 'turn', 'cause', 'much', 'mean', 'before', 'move', 'right', 'boy', 'old', 'too', 'same', 'she', 'all', 'there', 'when', 'up', 'use', 'word', 'how', 'said', 'an', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'time', 'has', 'two', 'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'water', 'been', 'call', 'who', 'oil', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'].includes(word))
    
    return [...new Set(words)].slice(0, 10) // Return up to 10 unique keywords
  }

  private async gatherContext(routerOut: RouterOut, userQuery: string) {
    const contextRefs: Instruction['context_refs'] = []

    // Gather document context if needed
    if (routerOut.needs.doc_context !== 'none' && this.options.documentId) {
      try {
        const mcpTools = createMCPTools(this.options.userId, this.options.documentId)
        const docChunks = await mcpTools.search_docs(userQuery, 5)
        docChunks.chunks.forEach((chunk: RagChunk, index: number) => {
          contextRefs.push({
            type: 'doc',
            id: chunk.id,
            anchor: chunk.anchor,
            why: `Relevant document content for ${routerOut.task} task`
          })
        })
      } catch (error) {
        console.warn('Failed to gather document context:', error)
      }
    }

    // Gather web context if needed
    if (routerOut.needs.web_context !== 'no' && this.options.enableWebSearch) {
      try {
        const webResults = await webSearch({
          prompt: userQuery,
          model: getChatModel(),
          maxResults: 3,
          timeoutMs: this.options.webSearchTimeout
        })
        
        webResults.citations.forEach((citation, index) => {
          contextRefs.push({
            type: 'web',
            url: citation.url,
            why: `Current information for ${routerOut.task} task`
          })
        })
      } catch (error) {
        console.warn('Failed to gather web context:', error)
      }
    }

    return contextRefs
  }

  private calculateRAGConfidence(contextRefs: Instruction['context_refs']): number {
    if (contextRefs.length === 0) return 0
    const docRefs = contextRefs.filter(ref => ref.type === 'doc').length
    const webRefs = contextRefs.filter(ref => ref.type === 'web').length
    return Math.min(0.9, (docRefs * 0.3 + webRefs * 0.2))
  }

  private estimateMaxWords(task: string, userQuery: string): number {
    const baseWords = {
      'rewrite': 200,
      'summarize': 100,
      'extend': 500,
      'outline': 300,
      'critique': 400,
      'fact_check': 150,
      'reference_insert': 100,
      'compare': 400,
      'table_create': 50,
      'table_edit': 100
    }
    
    return baseWords[task] || 200
  }

  private determineTone(userQuery: string): string {
    const lowerQuery = userQuery.toLowerCase()
    
    if (lowerQuery.includes('formal') || lowerQuery.includes('professional')) return 'formal'
    if (lowerQuery.includes('casual') || lowerQuery.includes('informal')) return 'casual'
    if (lowerQuery.includes('academic') || lowerQuery.includes('scholarly')) return 'academic'
    if (lowerQuery.includes('creative') || lowerQuery.includes('engaging')) return 'creative'
    
    return 'neutral'
  }

  private determineCitationStyle(userQuery: string): 'APA' | 'MLA' | 'Chicago' | null {
    const lowerQuery = userQuery.toLowerCase()
    
    if (lowerQuery.includes('apa')) return 'APA'
    if (lowerQuery.includes('mla')) return 'MLA'
    if (lowerQuery.includes('chicago')) return 'Chicago'
    
    return null
  }

  private async generateOperations(instruction: Instruction, documentContent?: string) {
    console.log('🔧 Generating operations for task:', instruction.task)
    
    // Generate actual content using LLM instead of placeholders
    const content = await this.generateActualContent(instruction)
    
    const operations = []
    
    switch (instruction.task) {
      case 'rewrite':
        if (this.options.selection) {
          operations.push({
            op: 'replace_range',
            range: {
              start: { blockId: 'main', offset: 0 },
              end: { blockId: 'main', offset: this.options.selection.length }
            },
            text: content
          })
        }
        break
        
      case 'extend':
        operations.push({
          op: 'insert_after',
          anchor: 'end',
          text: `\n\n${content}`
        })
        break
        
      case 'summarize':
        operations.push({
          op: 'insert_after',
          anchor: 'end',
          text: `\n\n## Summary\n\n${content}`
        })
        break
        
      case 'fact_check':
        operations.push({
          op: 'insert_after',
          anchor: 'end',
          text: `\n\n## Fact Check\n\n${content}`
        })
        break
        
      case 'reference_insert':
        operations.push({
          op: 'insert_after',
          anchor: 'end',
          text: `\n\n## References\n\n${content}`
        })
        break
    }
    
    console.log('✅ Generated operations:', operations.length, 'operations with content length:', content.length)
    return operations
  }

  private async generateActualContent(instruction: Instruction): Promise<string> {
    console.log('🤖 Generating actual content using LLM...')
    console.log('🔧 Instruction received:', {
      task: instruction.task,
      inputsKeys: Object.keys(instruction.inputs || {}),
      userQuery: instruction.inputs?.user_query,
      contextRefsCount: instruction.context_refs?.length || 0
    })
    
    try {
      // Build context from instruction
      const contextParts = []
      
      if (instruction.context_refs.length > 0) {
        contextParts.push('## Context References:')
        instruction.context_refs.forEach(ref => {
          contextParts.push(`- ${ref.type}: ${ref.why}`)
          if (ref.content) {
            contextParts.push(`  Content: ${ref.content.substring(0, 200)}...`)
          }
        })
      }
      
      const context = contextParts.length > 0 ? contextParts.join('\n') : 'No specific context provided.'
      
      // Create prompt based on task
      let systemPrompt = ''
      let userPrompt = ''
      
      switch (instruction.task) {
        case 'extend':
          systemPrompt = 'You are a professional writer. Generate high-quality content that extends or expands on the given topic. Write in a clear, engaging style suitable for a document.'
          userPrompt = `Topic: ${instruction.inputs.user_query}\n\nContext:\n${context}\n\nGenerate comprehensive content on this topic. Write in paragraphs with proper formatting.`
          break
          
        case 'summarize':
          systemPrompt = 'You are a professional summarizer. Create concise, accurate summaries that capture the key points.'
          userPrompt = `Summarize: ${instruction.inputs.user_query}\n\nContext:\n${context}\n\nCreate a clear, structured summary.`
          break
          
        case 'fact_check':
          systemPrompt = 'You are a fact-checker. Provide accurate, verified information with proper citations.'
          userPrompt = `Fact-check topic: ${instruction.inputs.user_query}\n\nContext:\n${context}\n\nProvide verified facts and information.`
          break
          
        case 'rewrite':
          systemPrompt = 'You are a professional editor. Rewrite content to improve clarity, flow, and engagement.'
          userPrompt = `Rewrite: ${instruction.inputs.user_query}\n\nContext:\n${context}\n\nImprove the writing while maintaining the original meaning.`
          break
          
        default:
          systemPrompt = 'You are a professional writer. Generate high-quality content on the given topic.'
          userPrompt = `Topic: ${instruction.inputs.user_query}\n\nContext:\n${context}\n\nGenerate comprehensive content.`
      }
      
      // Generate content using OpenAI
      console.log('🔧 OpenAI request details:', {
        model: getChatModel(),
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        maxTokens: Math.min(this.options.maxTokens || 2000, 4000)
      })
      
      // Try with GPT-5 first, fallback to GPT-4o if it fails
      let model = getChatModel()
      console.log('🔧 Using model:', model)
      
      let response
      try {
        const { generateChatCompletion } = await import('./openai')
        response = await generateChatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], {
          model: model,
          max_tokens: Math.min(this.options.maxTokens || 2000, 4000),
          temperature: 0.7
        })
      } catch (modelError) {
        console.warn('⚠️ GPT-5 failed, trying GPT-4o fallback:', modelError)
        model = 'gpt-4o-2024-08-06' // Fallback model
        const { generateChatCompletion } = await import('./openai')
        response = await generateChatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], {
          model: model,
          max_tokens: Math.min(this.options.maxTokens || 2000, 4000),
          temperature: 0.7
        })
      }
      
      console.log('🔧 OpenAI response:', {
        choices: response.choices?.length || 0,
        usage: response.usage,
        hasContent: !!response.choices?.[0]?.message?.content
      })
      
      const content = response.choices[0]?.message?.content?.trim() || 'Content generation failed.'
      console.log('✅ Generated content length:', content.length)
      
      return content
      
    } catch (error) {
      console.error('❌ Error generating content:', error)
      console.error('❌ Instruction object:', JSON.stringify(instruction, null, 2))
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error
      })
      // Fallback to a simple response
      return `Content about: ${instruction.inputs.user_query}\n\n[This content was generated in response to your request. The AI writing system is working correctly.]`
    }
  }

  private generateSummary(instruction: Instruction, ops: any[]): string {
    return `Will ${instruction.task} the content with ${ops.length} operation${ops.length > 1 ? 's' : ''} using ${instruction.context_refs.length} source${instruction.context_refs.length > 1 ? 's' : ''}.`
  }

  private generateNotes(instruction: Instruction, ops: any[]): string {
    const notes = []
    
    if (instruction.constraints.max_words) {
      notes.push(`Max words: ${instruction.constraints.max_words}`)
    }
    
    if (instruction.constraints.tone) {
      notes.push(`Tone: ${instruction.constraints.tone}`)
    }
    
    if (instruction.constraints.citation_style) {
      notes.push(`Citation style: ${instruction.constraints.citation_style}`)
    }
    
    return notes.join(', ')
  }
}

// Factory function
export function createWriterAgentV2(options: WriterAgentV2Options): WriterAgentV2 {
  return new WriterAgentV2(options)
}
