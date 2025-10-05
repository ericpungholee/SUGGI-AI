/**
 * Enhanced Preview Operations
 * Extended operations for structured content editing with document awareness
 */

import { DocumentStructure, DocumentElement, ContentPlacement } from './document-structure-analyzer'

export interface EnhancedPreviewOp {
  op: 'insert_after' | 'insert_before' | 'replace_range' | 'format_text' | 'create_heading' | 
      'create_list' | 'create_table' | 'insert_image' | 'create_link' | 'format_block' | 
      'merge_content' | 'split_content' | 'reorganize_sections'
  
  // Basic operation properties
  anchor?: string
  text?: string
  range?: {
    start: { blockId: string; offset: number }
    end: { blockId: string; offset: number }
  }
  
  // Enhanced structured content properties
  structure?: {
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'blockquote' | 'code' | 'image'
    level?: 1 | 2 | 3 | 4 | 5 | 6
    style?: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'
    alignment?: 'left' | 'center' | 'right' | 'justify'
    color?: string
    backgroundColor?: string
    fontSize?: string
    fontFamily?: string
  }
  
  // List-specific properties
  listType?: 'ordered' | 'unordered'
  listItems?: string[]
  listDepth?: number
  
  // Table-specific properties
  tableData?: string[][]
  tableHeaders?: string[]
  tableRows?: number
  tableColumns?: number
  
  // Link and image properties
  url?: string
  altText?: string
  title?: string
  
  // Content placement properties
  placement?: ContentPlacement
  context?: string
  
  // Merge and reorganization properties
  mergeWith?: string[]
  splitAt?: string
  reorganizeOrder?: string[]
  
  // Formatting properties
  formatting?: {
    preserveStructure?: boolean
    maintainHierarchy?: boolean
    respectExistingFormat?: boolean
  }
}

export interface EnhancedPreviewOps {
  pending_change_id: string
  document_analysis?: DocumentStructure
  placement_strategy: ContentPlacement
  ops: EnhancedPreviewOp[]
  citations: Array<{
    type: 'doc' | 'web'
    id?: string
    anchor?: string
    url?: string
    why: string
  }>
  summary: string
  notes: string
  structure_impact: {
    sections_added: number
    sections_modified: number
    sections_removed: number
    formatting_changes: number
    hierarchy_changes: boolean
  }
}

export class EnhancedPreviewOperationsGenerator {
  private documentAnalyzer: any // Will be injected

  constructor(documentAnalyzer?: any) {
    this.documentAnalyzer = documentAnalyzer
  }

  /**
   * Generate enhanced preview operations with document structure awareness
   */
  async generateEnhancedOperations(
    instruction: any,
    documentContent?: string,
    documentStructure?: DocumentStructure
  ): Promise<EnhancedPreviewOps> {
    console.log('🏗️ Generating enhanced preview operations...', {
      task: instruction.task,
      hasDocument: !!documentContent,
      hasStructure: !!documentStructure
    })

    const pendingChangeId = `enhanced_change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Analyze document structure if not provided
    let structure = documentStructure
    if (!structure && documentContent) {
      const analyzer = this.documentAnalyzer || require('./document-structure-analyzer').createDocumentStructureAnalyzer()
      structure = analyzer.analyzeDocument(documentContent)
    }

    // Generate structured content
    const structuredContent = await this.generateStructuredContent(instruction, structure)
    
    // Determine optimal placement strategy
    const placement = this.determineOptimalPlacement(instruction, structure, structuredContent)
    
    // Generate operations based on task and structure
    const ops = await this.generateOperationsForTask(instruction, structuredContent, placement, structure)
    
    // Calculate structure impact
    const structureImpact = this.calculateStructureImpact(ops, structure)
    
    // Extract citations
    const citations = this.extractCitations(instruction)
    
    // Generate summary and notes
    const summary = this.generateEnhancedSummary(instruction, ops, structureImpact)
    const notes = this.generateEnhancedNotes(instruction, placement, structureImpact)

    return {
      pending_change_id: pendingChangeId,
      document_analysis: structure,
      placement_strategy: placement,
      ops,
      citations,
      summary,
      notes,
      structure_impact: structureImpact
    }
  }

  /**
   * Generate structured content based on instruction and document context
   */
  private async generateStructuredContent(instruction: any, structure?: DocumentStructure): Promise<{
    content: string
    detectedStructure: any
    formatting: any
  }> {
    console.log('📝 Generating structured content...')

    // Generate base content (this would use LLM in real implementation)
    const baseContent = await this.generateBaseContent(instruction)
    
    // Detect structure in the generated content
    const detectedStructure = this.detectContentStructure(baseContent)
    
    // Apply appropriate formatting based on document type and context
    const formatting = this.determineFormatting(structure, detectedStructure)
    
    // Format the content appropriately
    const formattedContent = this.applyFormatting(baseContent, formatting, structure)

    return {
      content: formattedContent,
      detectedStructure,
      formatting
    }
  }

  /**
   * Determine optimal placement strategy
   */
  private determineOptimalPlacement(
    instruction: any,
    structure?: DocumentStructure,
    content?: any
  ): ContentPlacement {
    console.log('🎯 Determining optimal placement...')

    if (!structure) {
      return {
        position: 'end',
        suggestedStructure: 'append'
      }
    }

    // Use document analyzer to find optimal placement
    const analyzer = this.documentAnalyzer || require('./document-structure-analyzer').createDocumentStructureAnalyzer()
    const contentType = this.inferContentType(content?.detectedStructure)
    const userIntent = instruction.inputs?.user_query || instruction.task

    return analyzer.findOptimalPlacement(structure, contentType, userIntent)
  }

  /**
   * Generate operations for specific task
   */
  private async generateOperationsForTask(
    instruction: any,
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): Promise<EnhancedPreviewOp[]> {
    console.log('⚙️ Generating operations for task:', instruction.task)

    const operations: EnhancedPreviewOp[] = []

    switch (instruction.task) {
      case 'extend':
        operations.push(...this.generateExtendOperations(content, placement, structure))
        break
        
      case 'rewrite':
        operations.push(...this.generateRewriteOperations(content, placement, structure, instruction))
        break
        
      case 'summarize':
        operations.push(...this.generateSummarizeOperations(content, placement, structure))
        break
        
      case 'outline':
        operations.push(...this.generateOutlineOperations(content, placement, structure))
        break
        
      case 'fact_check':
        operations.push(...this.generateFactCheckOperations(content, placement, structure))
        break
        
      case 'reference_insert':
        operations.push(...this.generateReferenceOperations(content, placement, structure))
        break
        
      case 'table_create':
        operations.push(...this.generateTableOperations(content, placement, structure))
        break
        
      case 'table_edit':
        operations.push(...this.generateTableEditOperations(content, placement, structure, instruction))
        break
        
      default:
        operations.push(...this.generateDefaultOperations(content, placement, structure))
    }

    return operations
  }

  /**
   * Generate extend operations
   */
  private generateExtendOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    if (placement.suggestedStructure === 'append') {
      operations.push({
        op: 'insert_after',
        anchor: 'end',
        text: content.content,
        placement,
        formatting: {
          preserveStructure: true,
          maintainHierarchy: true
        }
      })
    } else if (placement.suggestedStructure === 'insert') {
      operations.push({
        op: 'insert_after',
        anchor: placement.anchor || 'end',
        text: content.content,
        placement,
        formatting: {
          preserveStructure: true,
          maintainHierarchy: true
        }
      })
    }

    // Add specific formatting operations based on detected structure
    if (content.detectedStructure.hasHeadings) {
      operations.push({
        op: 'format_block',
        text: content.content,
        structure: {
          type: 'heading',
          level: this.determineHeadingLevel(structure, placement)
        },
        formatting: {
          maintainHierarchy: true
        }
      })
    }

    if (content.detectedStructure.hasLists) {
      operations.push({
        op: 'create_list',
        listType: 'unordered',
        listItems: this.extractListItems(content.content),
        placement,
        formatting: {
          preserveStructure: true
        }
      })
    }

    return operations
  }

  /**
   * Generate rewrite operations
   */
  private generateRewriteOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure,
    instruction?: any
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    // Find the section to rewrite
    const targetSection = this.findTargetSectionForRewrite(structure, instruction)
    
    if (targetSection) {
      operations.push({
        op: 'replace_range',
        range: {
          start: { blockId: 'main', offset: targetSection.startPos },
          end: { blockId: 'main', offset: targetSection.endPos }
        },
        text: content.content,
        placement,
        formatting: {
          preserveStructure: true,
          respectExistingFormat: true
        }
      })
    } else {
      // Fallback to append if no specific section found
      operations.push({
        op: 'insert_after',
        anchor: 'end',
        text: content.content,
        placement
      })
    }

    return operations
  }

  /**
   * Generate summarize operations
   */
  private generateSummarizeOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    operations.push({
      op: 'create_heading',
      text: 'Summary',
      structure: {
        type: 'heading',
        level: 2
      },
      placement
    })

    operations.push({
      op: 'insert_after',
      anchor: 'Summary',
      text: content.content,
      placement,
      formatting: {
        preserveStructure: true
      }
    })

    return operations
  }

  /**
   * Generate outline operations
   */
  private generateOutlineOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    operations.push({
      op: 'create_heading',
      text: 'Outline',
      structure: {
        type: 'heading',
        level: 2
      },
      placement
    })

    // Parse content as outline items
    const outlineItems = this.parseOutlineItems(content.content)
    
    operations.push({
      op: 'create_list',
      listType: 'ordered',
      listItems: outlineItems,
      placement,
      formatting: {
        preserveStructure: true
      }
    })

    return operations
  }

  /**
   * Generate fact check operations
   */
  private generateFactCheckOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    operations.push({
      op: 'create_heading',
      text: 'Fact Check',
      structure: {
        type: 'heading',
        level: 2
      },
      placement
    })

    operations.push({
      op: 'insert_after',
      anchor: 'Fact Check',
      text: content.content,
      placement,
      formatting: {
        preserveStructure: true
      }
    })

    return operations
  }

  /**
   * Generate reference operations
   */
  private generateReferenceOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    operations.push({
      op: 'create_heading',
      text: 'References',
      structure: {
        type: 'heading',
        level: 2
      },
      placement
    })

    // Parse references and create links
    const references = this.parseReferences(content.content)
    
    references.forEach(ref => {
      operations.push({
        op: 'create_link',
        text: ref.title,
        url: ref.url,
        title: ref.description,
        placement
      })
    })

    return operations
  }

  /**
   * Generate table operations
   */
  private generateTableOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    // Parse table data from content
    const tableData = this.parseTableData(content.content)
    
    operations.push({
      op: 'create_table',
      tableData: tableData.rows,
      tableHeaders: tableData.headers,
      tableRows: tableData.rows.length,
      tableColumns: tableData.headers.length,
      placement
    })

    return operations
  }

  /**
   * Generate table edit operations
   */
  private generateTableEditOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure,
    instruction?: any
  ): EnhancedPreviewOp[] {
    const operations: EnhancedPreviewOp[] = []

    // Find existing table to edit
    const existingTable = this.findExistingTable(structure, instruction)
    
    if (existingTable) {
      operations.push({
        op: 'replace_range',
        range: {
          start: { blockId: 'table', offset: existingTable.startPos },
          end: { blockId: 'table', offset: existingTable.endPos }
        },
        text: content.content,
        placement,
        formatting: {
          preserveStructure: true
        }
      })
    }

    return operations
  }

  /**
   * Generate default operations
   */
  private generateDefaultOperations(
    content: any,
    placement: ContentPlacement,
    structure?: DocumentStructure
  ): EnhancedPreviewOp[] {
    return [{
      op: 'insert_after',
      anchor: 'end',
      text: content.content,
      placement,
      formatting: {
        preserveStructure: true
      }
    }]
  }

  /**
   * Calculate structure impact
   */
  private calculateStructureImpact(ops: EnhancedPreviewOp[], structure?: DocumentStructure): {
    sections_added: number
    sections_modified: number
    sections_removed: number
    formatting_changes: number
    hierarchy_changes: boolean
  } {
    let sections_added = 0
    let sections_modified = 0
    let sections_removed = 0
    let formatting_changes = 0
    let hierarchy_changes = false

    ops.forEach(op => {
      switch (op.op) {
        case 'insert_after':
        case 'insert_before':
        case 'create_heading':
        case 'create_list':
        case 'create_table':
          sections_added++
          break
        case 'replace_range':
          sections_modified++
          break
        case 'format_text':
        case 'format_block':
          formatting_changes++
          break
        case 'reorganize_sections':
          hierarchy_changes = true
          break
      }
    })

    return {
      sections_added,
      sections_modified,
      sections_removed,
      formatting_changes,
      hierarchy_changes
    }
  }

  // Helper methods
  private async generateBaseContent(instruction: any): Promise<string> {
    // Generate actual content using LLM
    try {
      const { generateChatCompletion } = await import('./openai')
      const { getChatModel } = await import('./core/models')
      
      const model = getChatModel()
      
      const systemPrompt = `You are an AI writing assistant. Generate high-quality content based on the user's request.

Task: ${instruction.task}
User Query: ${instruction.inputs?.user_query || instruction.task}

Generate comprehensive, well-structured content that directly addresses the user's request. Use proper formatting, clear structure, and provide valuable information.`

      const response = await generateChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction.inputs?.user_query || instruction.task }
      ], {
        model,
        max_tokens: 1000,
        temperature: 0.7
      })

      const content = response.choices[0]?.message?.content?.trim() || 'Generated content'
      console.log('✅ Generated base content:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + '...',
        fullContent: content
      })
      
      return content
    } catch (error) {
      console.error('❌ Error generating base content:', error)
      // Fallback to a more descriptive placeholder
      return `Content for ${instruction.task}: ${instruction.inputs?.user_query || 'Generated content'}`
    }
  }

  private detectContentStructure(content: string): any {
    return {
      hasHeadings: /^#{1,6}\s+/m.test(content),
      hasLists: /^\s*[-*+]\s+/m.test(content) || /^\s*\d+\.\s+/m.test(content),
      hasTables: /\|.*\|/m.test(content),
      hasFormatting: /\*\*.*\*\*/.test(content) || /\*.*\*/.test(content)
    }
  }

  private determineFormatting(structure?: DocumentStructure, detectedStructure?: any): any {
    return {
      preserveMarkdown: structure?.type === 'markdown',
      preserveHtml: structure?.type === 'html',
      maintainHierarchy: true,
      respectExistingFormat: true
    }
  }

  private applyFormatting(content: string, formatting: any, structure?: DocumentStructure): string {
    // Apply formatting based on document type and structure
    return content
  }

  private inferContentType(detectedStructure?: any): 'heading' | 'paragraph' | 'list' | 'table' | 'mixed' {
    if (detectedStructure?.hasTables) return 'table'
    if (detectedStructure?.hasLists) return 'list'
    if (detectedStructure?.hasHeadings) return 'heading'
    return 'paragraph'
  }

  private determineHeadingLevel(structure?: DocumentStructure, placement?: ContentPlacement): 1 | 2 | 3 | 4 | 5 | 6 {
    // Determine appropriate heading level based on document hierarchy
    if (!structure || structure.headings.length === 0) return 1
    
    const lastHeading = structure.headings[structure.headings.length - 1]
    return Math.min(6, lastHeading.level + 1) as 1 | 2 | 3 | 4 | 5 | 6
  }

  private extractListItems(content: string): string[] {
    const items: string[] = []
    const lines = content.split('\n')
    
    lines.forEach(line => {
      const match = line.match(/^\s*[-*+]\s+(.+)$/)
      if (match) {
        items.push(match[1])
      }
    })
    
    return items
  }

  private findTargetSectionForRewrite(structure?: DocumentStructure, instruction?: any): DocumentElement | null {
    if (!structure) return null
    
    // Find section that matches the rewrite intent
    return structure.elements.find(el => 
      el.content.toLowerCase().includes(instruction?.inputs?.user_query?.toLowerCase() || '')
    ) || null
  }

  private parseOutlineItems(content: string): string[] {
    const items: string[] = []
    const lines = content.split('\n')
    
    lines.forEach(line => {
      const match = line.match(/^\s*\d+\.\s+(.+)$/)
      if (match) {
        items.push(match[1])
      }
    })
    
    return items
  }

  private parseReferences(content: string): Array<{title: string, url: string, description: string}> {
    // Parse references from content
    const references: Array<{title: string, url: string, description: string}> = []
    
    // This would parse actual reference formats
    return references
  }

  private parseTableData(content: string): {headers: string[], rows: string[][]} {
    // Parse table data from content
    return {
      headers: [],
      rows: []
    }
  }

  private findExistingTable(structure?: DocumentStructure, instruction?: any): DocumentElement | null {
    if (!structure) return null
    
    return structure.tables.find(table => 
      table.content.includes(instruction?.inputs?.user_query || '')
    ) || null
  }

  private extractCitations(instruction: any): Array<{
    type: 'doc' | 'web'
    id?: string
    anchor?: string
    url?: string
    why: string
  }> {
    return instruction.context_refs?.map((ref: any) => ({
      type: ref.type,
      id: ref.id,
      anchor: ref.anchor,
      url: ref.url,
      why: ref.why
    })) || []
  }

  private generateEnhancedSummary(instruction: any, ops: EnhancedPreviewOp[], impact: any): string {
    const task = instruction.task
    const opCount = ops.length
    
    return `Generated ${opCount} operations for ${task} task. Added ${impact.sections_added} sections, modified ${impact.sections_modified} sections, and made ${impact.formatting_changes} formatting changes.`
  }

  private generateEnhancedNotes(instruction: any, placement: ContentPlacement, impact: any): string {
    const notes = []
    
    if (impact.hierarchy_changes) {
      notes.push('Document hierarchy has been modified')
    }
    
    if (placement.suggestedStructure) {
      notes.push(`Content placement strategy: ${placement.suggestedStructure}`)
    }
    
    return notes.join('. ')
  }
}

/**
 * Factory function to create enhanced operations generator
 */
export function createEnhancedPreviewOperationsGenerator(documentAnalyzer?: any): EnhancedPreviewOperationsGenerator {
  return new EnhancedPreviewOperationsGenerator(documentAnalyzer)
}
