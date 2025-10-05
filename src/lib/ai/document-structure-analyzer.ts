/**
 * Document Structure Analyzer
 * Analyzes document content to understand structure, formatting, and context
 */

export interface DocumentStructure {
  type: 'markdown' | 'html' | 'plain' | 'mixed'
  elements: DocumentElement[]
  headings: HeadingElement[]
  lists: ListElement[]
  tables: TableElement[]
  blocks: BlockElement[]
  metadata: {
    wordCount: number
    paragraphCount: number
    hasImages: boolean
    hasLinks: boolean
    structureComplexity: 'simple' | 'moderate' | 'complex'
  }
}

export interface DocumentElement {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'blockquote' | 'code' | 'image' | 'link'
  level?: number
  content: string
  startPos: number
  endPos: number
  parentIndex?: number
  children?: number[]
}

export interface HeadingElement extends DocumentElement {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  anchor?: string
}

export interface ListElement extends DocumentElement {
  type: 'list'
  listType: 'ordered' | 'unordered'
  items: string[]
  depth: number
}

export interface TableElement extends DocumentElement {
  type: 'table'
  rows: number
  columns: number
  headers?: string[]
  data: string[][]
}

export interface BlockElement extends DocumentElement {
  type: 'blockquote' | 'code'
  language?: string
}

export interface ContentPlacement {
  position: 'beginning' | 'middle' | 'end' | 'specific'
  anchor?: string
  context?: string
  suggestedStructure?: 'append' | 'insert' | 'replace' | 'enhance'
}

export class DocumentStructureAnalyzer {
  /**
   * Analyze document content and extract structure information
   */
  analyzeDocument(content: string): DocumentStructure {
    console.log('🔍 Analyzing document structure...', { contentLength: content.length })

    const elements: DocumentElement[] = []
    const headings: HeadingElement[] = []
    const lists: ListElement[] = []
    const tables: TableElement[] = []
    const blocks: BlockElement[] = []

    // Parse different content types
    if (this.isMarkdownContent(content)) {
      this.parseMarkdown(content, elements, headings, lists, tables, blocks)
    } else if (this.isHtmlContent(content)) {
      this.parseHtml(content, elements, headings, lists, tables, blocks)
    } else {
      this.parsePlainText(content, elements)
    }

    // Calculate metadata
    const metadata = this.calculateMetadata(content, elements)

    return {
      type: this.determineContentType(content),
      elements,
      headings,
      lists,
      tables,
      blocks,
      metadata
    }
  }

  /**
   * Find the best placement for new content based on document structure
   */
  findOptimalPlacement(
    structure: DocumentStructure,
    contentType: 'heading' | 'paragraph' | 'list' | 'table' | 'mixed',
    userIntent: string
  ): ContentPlacement {
    console.log('🎯 Finding optimal placement for:', { contentType, userIntent })

    // Analyze user intent to determine placement strategy
    const intent = this.analyzeUserIntent(userIntent)
    
    // Find relevant sections based on content type and intent
    const relevantSections = this.findRelevantSections(structure, intent)
    
    // Determine placement strategy
    if (intent.includes('append') || intent.includes('add at end')) {
      return {
        position: 'end',
        context: this.getContextFromPosition(structure, 'end'),
        suggestedStructure: 'append'
      }
    }

    if (intent.includes('insert') || intent.includes('add after')) {
      const anchor = this.findInsertionAnchor(structure, intent)
      return {
        position: 'specific',
        anchor,
        context: this.getContextFromAnchor(structure, anchor),
        suggestedStructure: 'insert'
      }
    }

    if (intent.includes('replace') || intent.includes('rewrite')) {
      const targetSection = this.findTargetSection(structure, intent)
      return {
        position: 'specific',
        anchor: targetSection?.content || 'main',
        context: targetSection?.content || '',
        suggestedStructure: 'replace'
      }
    }

    // Default: intelligent placement based on document structure
    return this.findIntelligentPlacement(structure, contentType, intent)
  }

  /**
   * Generate structured content with proper formatting
   */
  generateStructuredContent(
    content: string,
    structure: DocumentStructure,
    placement: ContentPlacement
  ): string {
    console.log('🏗️ Generating structured content...', { 
      contentLength: content.length,
      placement: placement.suggestedStructure 
    })

    // Detect content structure from the input
    const detectedStructure = this.detectContentStructure(content)
    
    // Apply appropriate formatting based on document type and placement
    let formattedContent = content

    switch (structure.type) {
      case 'markdown':
        formattedContent = this.formatAsMarkdown(content, detectedStructure, placement)
        break
      case 'html':
        formattedContent = this.formatAsHtml(content, detectedStructure, placement)
        break
      default:
        formattedContent = this.formatAsPlainText(content, detectedStructure, placement)
    }

    // Add proper spacing and context based on placement
    return this.addContextualSpacing(formattedContent, placement, structure)
  }

  /**
   * Check if content is markdown
   */
  private isMarkdownContent(content: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+/m,           // Headers
      /\*\*.*\*\*/,            // Bold
      /\*.*\*/,                // Italic
      /^\s*[-*+]\s+/m,         // Unordered lists
      /^\s*\d+\.\s+/m,         // Ordered lists
      /```[\s\S]*```/,         // Code blocks
      /^>\s+/m,                // Blockquotes
      /\[.*\]\(.*\)/,          // Links
      /\|.*\|/                 // Tables
    ]

    return markdownPatterns.some(pattern => pattern.test(content))
  }

  /**
   * Check if content is HTML
   */
  private isHtmlContent(content: string): boolean {
    const htmlPattern = /<[^>]+>/g
    return htmlPattern.test(content)
  }

  /**
   * Parse markdown content
   */
  private parseMarkdown(
    content: string,
    elements: DocumentElement[],
    headings: HeadingElement[],
    lists: ListElement[],
    tables: TableElement[],
    blocks: BlockElement[]
  ): void {
    const lines = content.split('\n')
    let currentPos = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const startPos = currentPos
      const endPos = currentPos + line.length

      // Parse headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6
        const heading: HeadingElement = {
          type: 'heading',
          level,
          content: headingMatch[2],
          startPos,
          endPos
        }
        elements.push(heading)
        headings.push(heading)
        currentPos += line.length + 1 // +1 for newline
        continue
      }

      // Parse lists
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)
      if (listMatch) {
        // This is a simplified list parsing - in reality, you'd want more sophisticated parsing
        const listType = /^\d+\./.test(listMatch[2]) ? 'ordered' : 'unordered'
        const list: ListElement = {
          type: 'list',
          listType,
          items: [listMatch[3]],
          depth: listMatch[1].length,
          content: line,
          startPos,
          endPos
        }
        elements.push(list)
        lists.push(list)
        currentPos += line.length + 1
        continue
      }

      // Parse blockquotes
      const blockquoteMatch = line.match(/^>\s*(.+)$/)
      if (blockquoteMatch) {
        const block: BlockElement = {
          type: 'blockquote',
          content: blockquoteMatch[1],
          startPos,
          endPos
        }
        elements.push(block)
        blocks.push(block)
        currentPos += line.length + 1
        continue
      }

      // Parse code blocks
      const codeMatch = line.match(/^```(\w+)?$/)
      if (codeMatch) {
        // This is simplified - you'd want to parse the entire code block
        const block: BlockElement = {
          type: 'code',
          content: line,
          language: codeMatch[1],
          startPos,
          endPos
        }
        elements.push(block)
        blocks.push(block)
        currentPos += line.length + 1
        continue
      }

      // Regular paragraphs
      if (line.trim()) {
        const paragraph: DocumentElement = {
          type: 'paragraph',
          content: line,
          startPos,
          endPos
        }
        elements.push(paragraph)
      }

      currentPos += line.length + 1
    }
  }

  /**
   * Parse HTML content
   */
  private parseHtml(
    content: string,
    elements: DocumentElement[],
    headings: HeadingElement[],
    lists: ListElement[],
    tables: TableElement[],
    blocks: BlockElement[]
  ): void {
    // Simplified HTML parsing - in production, you'd want a proper HTML parser
    const headingRegex = /<(h[1-6])[^>]*>(.*?)<\/h[1-6]>/gi
    let match

    while ((match = headingRegex.exec(content)) !== null) {
      const level = parseInt(match[1].substring(1)) as 1 | 2 | 3 | 4 | 5 | 6
      const heading: HeadingElement = {
        type: 'heading',
        level,
        content: match[2],
        startPos: match.index,
        endPos: match.index + match[0].length
      }
      elements.push(heading)
      headings.push(heading)
    }

    // Add other HTML parsing logic as needed
  }

  /**
   * Parse plain text content
   */
  private parsePlainText(content: string, elements: DocumentElement[]): void {
    const paragraphs = content.split(/\n\s*\n/)
    let currentPos = 0

    paragraphs.forEach(paragraph => {
      if (paragraph.trim()) {
        const startPos = content.indexOf(paragraph, currentPos)
        const endPos = startPos + paragraph.length
        
        elements.push({
          type: 'paragraph',
          content: paragraph.trim(),
          startPos,
          endPos
        })
        
        currentPos = endPos
      }
    })
  }

  /**
   * Calculate document metadata
   */
  private calculateMetadata(content: string, elements: DocumentElement[]) {
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    const paragraphCount = elements.filter(el => el.type === 'paragraph').length
    const hasImages = content.includes('<img') || content.includes('![')
    const hasLinks = content.includes('<a href') || content.includes('[')
    
    let structureComplexity: 'simple' | 'moderate' | 'complex' = 'simple'
    if (elements.length > 20 || wordCount > 1000) {
      structureComplexity = 'complex'
    } else if (elements.length > 10 || wordCount > 500) {
      structureComplexity = 'moderate'
    }

    return {
      wordCount,
      paragraphCount,
      hasImages,
      hasLinks,
      structureComplexity
    }
  }

  /**
   * Determine content type
   */
  private determineContentType(content: string): 'markdown' | 'html' | 'plain' | 'mixed' {
    const hasMarkdown = this.isMarkdownContent(content)
    const hasHtml = this.isHtmlContent(content)

    if (hasMarkdown && hasHtml) return 'mixed'
    if (hasMarkdown) return 'markdown'
    if (hasHtml) return 'html'
    return 'plain'
  }

  /**
   * Analyze user intent for content placement
   */
  private analyzeUserIntent(intent: string): string {
    const intentLower = intent.toLowerCase()
    
    if (intentLower.includes('append') || intentLower.includes('add at end')) {
      return 'append'
    }
    if (intentLower.includes('insert') || intentLower.includes('add after')) {
      return 'insert'
    }
    if (intentLower.includes('replace') || intentLower.includes('rewrite')) {
      return 'replace'
    }
    if (intentLower.includes('beginning') || intentLower.includes('start')) {
      return 'beginning'
    }
    
    return 'intelligent'
  }

  /**
   * Find relevant sections based on intent
   */
  private findRelevantSections(structure: DocumentStructure, intent: string): DocumentElement[] {
    // This would analyze the document structure and find sections relevant to the user's intent
    // For now, return all headings as relevant sections
    return structure.headings
  }

  /**
   * Find insertion anchor
   */
  private findInsertionAnchor(structure: DocumentStructure, intent: string): string {
    // Analyze intent to find the best insertion point
    // This is a simplified implementation
    if (structure.headings.length > 0) {
      return structure.headings[structure.headings.length - 1].content
    }
    return 'end'
  }

  /**
   * Find target section for replacement
   */
  private findTargetSection(structure: DocumentStructure, intent: string): DocumentElement | null {
    // Find the section that matches the user's intent
    // This is a simplified implementation
    return structure.elements.find(el => 
      el.content.toLowerCase().includes(intent.toLowerCase())
    ) || null
  }

  /**
   * Find intelligent placement
   */
  private findIntelligentPlacement(
    structure: DocumentStructure,
    contentType: string,
    intent: string
  ): ContentPlacement {
    // Intelligent placement logic based on document structure and content type
    if (structure.headings.length === 0) {
      return { position: 'end', suggestedStructure: 'append' }
    }

    // Find the most relevant section based on content type and intent
    const relevantSection = this.findMostRelevantSection(structure, contentType, intent)
    
    return {
      position: 'specific',
      anchor: relevantSection?.content || 'end',
      context: relevantSection?.content || '',
      suggestedStructure: 'insert'
    }
  }

  /**
   * Find most relevant section
   */
  private findMostRelevantSection(
    structure: DocumentStructure,
    contentType: string,
    intent: string
  ): DocumentElement | null {
    // This would use semantic analysis to find the most relevant section
    // For now, return the last heading
    return structure.headings[structure.headings.length - 1] || null
  }

  /**
   * Detect content structure from input
   */
  private detectContentStructure(content: string): {
    hasHeadings: boolean
    hasLists: boolean
    hasTables: boolean
    hasFormatting: boolean
  } {
    return {
      hasHeadings: /^#{1,6}\s+/m.test(content),
      hasLists: /^\s*[-*+]\s+/m.test(content) || /^\s*\d+\.\s+/m.test(content),
      hasTables: /\|.*\|/m.test(content),
      hasFormatting: /\*\*.*\*\*/.test(content) || /\*.*\*/.test(content)
    }
  }

  /**
   * Format content as markdown
   */
  private formatAsMarkdown(content: string, structure: any, placement: ContentPlacement): string {
    // Apply markdown formatting based on detected structure
    let formatted = content

    if (structure.hasHeadings) {
      // Ensure proper heading hierarchy
      formatted = this.normalizeMarkdownHeadings(formatted)
    }

    if (structure.hasLists) {
      // Ensure proper list formatting
      formatted = this.normalizeMarkdownLists(formatted)
    }

    return formatted
  }

  /**
   * Format content as HTML
   */
  private formatAsHtml(content: string, structure: any, placement: ContentPlacement): string {
    // Convert content to HTML format
    return content // Simplified - would need proper HTML conversion
  }

  /**
   * Format content as plain text
   */
  private formatAsPlainText(content: string, structure: any, placement: ContentPlacement): string {
    // Apply plain text formatting
    return content
  }

  /**
   * Add contextual spacing
   */
  private addContextualSpacing(content: string, placement: ContentPlacement, structure: DocumentStructure): string {
    let formatted = content

    // Add appropriate spacing based on placement and document structure
    if (placement.suggestedStructure === 'append') {
      formatted = '\n\n' + formatted
    } else if (placement.suggestedStructure === 'insert') {
      formatted = '\n' + formatted + '\n'
    }

    return formatted
  }

  /**
   * Normalize markdown headings
   */
  private normalizeMarkdownHeadings(content: string): string {
    // Ensure proper heading hierarchy and spacing
    return content.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2\n')
  }

  /**
   * Normalize markdown lists
   */
  private normalizeMarkdownLists(content: string): string {
    // Ensure proper list formatting
    return content.replace(/^(\s*)([-*+]|\d+\.)\s+(.+)$/gm, '$1$2 $3')
  }

  /**
   * Get context from position
   */
  private getContextFromPosition(structure: DocumentStructure, position: 'beginning' | 'end'): string {
    if (position === 'end' && structure.elements.length > 0) {
      const lastElement = structure.elements[structure.elements.length - 1]
      return lastElement.content
    }
    if (position === 'beginning' && structure.elements.length > 0) {
      const firstElement = structure.elements[0]
      return firstElement.content
    }
    return ''
  }

  /**
   * Get context from anchor
   */
  private getContextFromAnchor(structure: DocumentStructure, anchor: string): string {
    const element = structure.elements.find(el => el.content.includes(anchor))
    return element?.content || ''
  }
}

/**
 * Factory function to create analyzer instance
 */
export function createDocumentStructureAnalyzer(): DocumentStructureAnalyzer {
  return new DocumentStructureAnalyzer()
}
