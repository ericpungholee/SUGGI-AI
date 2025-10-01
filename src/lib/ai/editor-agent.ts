/**
 * AI Editor Agent - Direct editor manipulation interface
 */

export interface EditorContent {
  html: string
  plainText: string
  wordCount: number
}

export interface EditorPosition {
  start: number
  end: number
}

export interface AIEditorAgent {
  writeContent: (content: string, position?: EditorPosition) => Promise<void>
  replaceContent: (oldContent: string, newContent: string) => void
  insertAtPosition: (content: string, position: number) => void
  appendContent: (content: string) => void
  prependContent: (content: string) => void
  clearEditor: () => void
  getCurrentContent: () => EditorContent
  formatAsMarkdown: (content: string) => string
  
  // Delete operations
  deleteSelection: () => void
  deleteText: (text: string) => void
  deleteAtPosition: (position: number, length: number) => void
  deleteLine: (lineNumber: number) => void
  deleteParagraph: (paragraphIndex: number) => void
  
  // Selection operations
  selectText: (start: number, end: number) => void
  selectAll: () => void
  getSelection: () => { text: string; start: number; end: number } | null
  
  // Undo/Redo operations
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  
  // Formatting operations
  applyFormat: (command: string, value?: string) => void
  formatSelection: (command: string, value?: string) => void
  setTextColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setFontSize: (size: string) => void
  setFontFamily: (family: string) => void
  makeBold: () => void
  makeItalic: () => void
  makeUnderline: () => void
  makeStrikethrough: () => void
  makeSubscript: () => void
  makeSuperscript: () => void
  alignText: (alignment: 'left' | 'center' | 'right' | 'justify') => void
  createList: (type: 'ordered' | 'unordered') => void
  createHeading: (level: 1 | 2 | 3 | 4) => void
  createBlockquote: () => void
  createCodeBlock: () => void
  createLink: (url: string, text?: string) => void
  
  // Table operations
  insertTable: (rows: number, cols: number) => void
  insertTableRow: (position: 'above' | 'below') => void
  insertTableColumn: (position: 'left' | 'right') => void
  deleteTableRow: () => void
  deleteTableColumn: () => void
  deleteTable: () => void
  isInsideTable: () => boolean
  
  // Human-like writing operations
  typeText: (text: string, speed?: number) => Promise<void>
  typeWithFormatting: (text: string, format?: { bold?: boolean; italic?: boolean; underline?: boolean }) => Promise<void>
  pressEnter: () => void
  pressTab: () => void
  pressBackspace: () => void
  pressDelete: () => void
  
  // Simple writing methods
  writeSimpleText: (text: string) => void
  appendSimpleText: (text: string) => void
  
  // Utility operations
  ensureEditable: () => void
}

export class EditorAgent implements AIEditorAgent {
  private editorRef: React.RefObject<HTMLDivElement>
  private onContentChange?: (content: string) => void
  private onSaveToUndoStack?: (content: string) => void

  constructor(
    editorRef: React.RefObject<HTMLDivElement>, 
    onContentChange?: (content: string) => void,
    onSaveToUndoStack?: (content: string) => void
  ) {
    this.editorRef = editorRef
    this.onContentChange = onContentChange
    this.onSaveToUndoStack = onSaveToUndoStack
  }

  /**
   * Write content to the editor using a simpler, more reliable approach
   */
  async writeContent(content: string, position?: EditorPosition): Promise<void> {
    console.log('🔍 EditorAgent writeContent called (simplified):', {
      hasEditorRef: !!this.editorRef.current,
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + '...',
      hasPosition: !!position
    })

    if (!this.editorRef.current) {
      console.error('❌ EditorAgent: Editor reference is null')
      return
    }

    if (!content || content.trim() === '') {
      console.warn('⚠️ EditorAgent: Empty content provided')
      return
    }

    try {
      // Ensure editor is focused and ready
      this.editorRef.current.focus()
      this.ensureEditable()

      // If position is specified, move cursor there first
      if (position) {
        this.selectText(position.start, position.end)
      }

      // Use a simpler approach - write content in chunks with natural timing
      const lines = content.split('\n')
      let fullContent = ''
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmedLine = line.trim()
        
        // Handle different line types with simple HTML
        if (trimmedLine.startsWith('# ')) {
          fullContent += `<h1>${trimmedLine.substring(2)}</h1>`
        } else if (trimmedLine.startsWith('## ')) {
          fullContent += `<h2>${trimmedLine.substring(3)}</h2>`
        } else if (trimmedLine.startsWith('### ')) {
          fullContent += `<h3>${trimmedLine.substring(4)}</h3>`
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
          fullContent += `<ul><li>${trimmedLine.substring(2)}</li></ul>`
        } else if (trimmedLine.match(/^\d+\. /)) {
          fullContent += `<ol><li>${trimmedLine.replace(/^\d+\. /, '')}</li></ol>`
        } else if (trimmedLine.startsWith('> ')) {
          fullContent += `<blockquote>${trimmedLine.substring(2)}</blockquote>`
        } else if (trimmedLine.startsWith('```')) {
          // Handle code blocks
          if (i < lines.length - 1 && !lines[i + 1].startsWith('```')) {
            fullContent += '<pre><code>'
            i++
            while (i < lines.length && !lines[i].startsWith('```')) {
              fullContent += lines[i] + '\n'
              i++
            }
            fullContent += '</code></pre>'
          }
        } else if (trimmedLine === '') {
          fullContent += '<p><br></p>'
        } else {
          // Regular paragraph with simple formatting
          const formattedLine = this.formatInlineMarkdown(line)
          fullContent += `<p>${formattedLine}</p>`
        }
        
        // Add delay between lines for natural feel
        if (i < lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      // Write the content using the reliable updateEditor method
      const currentContent = this.editorRef.current.innerHTML || ''
      const newContent = currentContent + (currentContent ? '' : '') + fullContent
      
      this.updateEditor(newContent)
      console.log('✅ AI Agent wrote content (simplified):', content.substring(0, 100) + '...')
    } catch (error) {
      console.error('❌ EditorAgent writeContent error:', error)
      // Fallback to simple text insertion
      try {
        const currentContent = this.editorRef.current.innerHTML || ''
        const newContent = currentContent + (currentContent ? '<p>' : '') + content.replace(/\n/g, '</p><p>') + '</p>'
        this.updateEditor(newContent)
        console.log('✅ AI Agent wrote content (fallback):', content.substring(0, 100) + '...')
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
        throw new Error(`Failed to write content: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Type text with inline formatting detection
   */
  private async typeTextWithInlineFormatting(text: string): Promise<void> {
    if (!text) return

    // Simple regex patterns for common formatting
    const boldPattern = /\*\*(.*?)\*\*/g
    const italicPattern = /\*(.*?)\*/g
    const underlinePattern = /__(.*?)__/g
    const codePattern = /`(.*?)`/g

    let remainingText = text
    let lastIndex = 0

    // Find all formatting markers
    const markers: Array<{ start: number; end: number; type: string; content: string }> = []
    
    let match
    while ((match = boldPattern.exec(text)) !== null) {
      markers.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'bold',
        content: match[1]
      })
    }
    
    while ((match = italicPattern.exec(text)) !== null) {
      markers.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'italic',
        content: match[1]
      })
    }
    
    while ((match = underlinePattern.exec(text)) !== null) {
      markers.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'underline',
        content: match[1]
      })
    }
    
    while ((match = codePattern.exec(text)) !== null) {
      markers.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'code',
        content: match[1]
      })
    }

    // Sort markers by position
    markers.sort((a, b) => a.start - b.start)

    // Type text with formatting
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i]
      
      // Type text before this marker
      if (marker.start > lastIndex) {
        await this.typeText(text.substring(lastIndex, marker.start))
      }
      
      // Apply formatting and type the formatted text
      if (marker.type === 'bold') {
        this.makeBold()
        await this.typeText(marker.content)
        this.makeBold() // Toggle off
      } else if (marker.type === 'italic') {
        this.makeItalic()
        await this.typeText(marker.content)
        this.makeItalic() // Toggle off
      } else if (marker.type === 'underline') {
        this.makeUnderline()
        await this.typeText(marker.content)
        this.makeUnderline() // Toggle off
      } else if (marker.type === 'code') {
        // For code, we'll just type it as is for now
        await this.typeText(marker.content)
      }
      
      lastIndex = marker.end
    }
    
    // Type any remaining text
    if (lastIndex < text.length) {
      await this.typeText(text.substring(lastIndex))
    }
  }

  /**
   * Replace specific content in the editor
   */
  replaceContent(oldContent: string, newContent: string): void {
    if (!this.editorRef.current) return

    const editor = this.editorRef.current
    const currentContent = editor.innerHTML || ''
    
    if (currentContent.includes(oldContent)) {
      const newEditorContent = currentContent.replace(oldContent, this.formatAsMarkdown(newContent))
      this.updateEditor(newEditorContent)
      console.log('🤖 AI Agent replaced content in editor')
    }
  }

  /**
   * Insert content at specific position
   */
  insertAtPosition(content: string, position: number): void {
    if (!this.editorRef.current) return

    const editor = this.editorRef.current
    const currentContent = editor.innerHTML || ''
    
    const before = currentContent.substring(0, position)
    const after = currentContent.substring(position)
    const newContent = before + this.formatAsMarkdown(content) + after
    
    this.updateEditor(newContent)
    console.log('🤖 AI Agent inserted content at position:', position)
  }

  /**
   * Append content to the end of the editor
   */
  appendContent(content: string): void {
    this.writeContent(content)
  }

  /**
   * Prepend content to the beginning of the editor
   */
  prependContent(content: string): void {
    if (!this.editorRef.current) return

    const editor = this.editorRef.current
    const currentContent = editor.innerHTML || ''
    const newContent = this.formatAsMarkdown(content) + (currentContent ? '\n\n' : '') + currentContent
    
    this.updateEditor(newContent)
    console.log('🤖 AI Agent prepended content to editor')
  }

  /**
   * Clear all editor content
   */
  clearEditor(): void {
    if (!this.editorRef.current) return

    this.updateEditor('')
    console.log('🤖 AI Agent cleared editor')
  }

  /**
   * Get current editor content
   */
  getCurrentContent(): EditorContent {
    if (!this.editorRef.current) {
      return { html: '', plainText: '', wordCount: 0 }
    }

    const editor = this.editorRef.current
    const html = editor.innerHTML || ''
    const plainText = editor.textContent || ''
    const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length

    return { html, plainText, wordCount }
  }

  /**
   * Format content as markdown
   */
  formatAsMarkdown(content: string): string {
    if (!content.trim()) return ''
    
    // Split content into lines for better processing
    const lines = content.split('\n')
    const processedLines: string[] = []
    let inList = false
    let inCodeBlock = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      
      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        if (!inCodeBlock) {
          processedLines.push('<pre><code>')
          inCodeBlock = true
        } else {
          processedLines.push('</code></pre>')
          inCodeBlock = false
        }
        continue
      }
      
      if (inCodeBlock) {
        processedLines.push(line)
        continue
      }
      
      // Handle headers
      if (trimmedLine.startsWith('### ')) {
        processedLines.push(`<h3>${trimmedLine.substring(4)}</h3>`)
        inList = false
        continue
      }
      
      if (trimmedLine.startsWith('## ')) {
        processedLines.push(`<h2>${trimmedLine.substring(3)}</h2>`)
        inList = false
        continue
      }
      
      if (trimmedLine.startsWith('# ')) {
        processedLines.push(`<h1>${trimmedLine.substring(2)}</h1>`)
        inList = false
        continue
      }
      
      // Handle lists
      if (trimmedLine.match(/^[\*\-\+] /) || trimmedLine.match(/^\d+\. /)) {
        if (!inList) {
          processedLines.push('<ul>')
          inList = true
        }
        const listItem = trimmedLine.replace(/^[\*\-\+]\s*/, '').replace(/^\d+\.\s*/, '')
        processedLines.push(`<li>${this.formatInlineMarkdown(listItem)}</li>`)
        continue
      }
      
      // End list if we encounter a non-list item
      if (inList && !trimmedLine.match(/^[\*\-\+] /) && !trimmedLine.match(/^\d+\. /) && trimmedLine !== '') {
        processedLines.push('</ul>')
        inList = false
      }
      
      // Handle empty lines
      if (trimmedLine === '') {
        processedLines.push('')
        continue
      }
      
      // Handle regular paragraphs
      processedLines.push(`<p>${this.formatInlineMarkdown(line)}</p>`)
    }
    
    // Close any open list
    if (inList) {
      processedLines.push('</ul>')
    }
    
    return processedLines.join('\n')
  }
  
  /**
   * Format inline markdown elements
   */
  private formatInlineMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
  }

  /**
   * Delete selected text
   */
  deleteSelection(): void {
    if (!this.editorRef.current) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    try {
      range.deleteContents()
      this.updateEditor(this.editorRef.current.innerHTML)
      console.log('✅ Deleted selected text')
    } catch (error) {
      console.error('❌ Error deleting selection:', error)
    }
  }

  /**
   * Delete specific text from the editor
   */
  deleteText(text: string): void {
    if (!this.editorRef.current || !text) return

    try {
      const currentContent = this.editorRef.current.innerHTML
      if (currentContent.includes(text)) {
        const newContent = currentContent.replace(text, '')
        this.updateEditor(newContent)
        console.log('✅ Deleted text:', text)
      } else {
        console.warn('⚠️ Text not found for deletion:', text)
      }
    } catch (error) {
      console.error('❌ Error deleting text:', error)
    }
  }

  /**
   * Delete text at specific position
   */
  deleteAtPosition(position: number, length: number): void {
    if (!this.editorRef.current) return

    try {
      const currentContent = this.editorRef.current.innerHTML
      const before = currentContent.substring(0, position)
      const after = currentContent.substring(position + length)
      const newContent = before + after
      
      this.updateEditor(newContent)
      console.log('✅ Deleted text at position:', position, 'length:', length)
    } catch (error) {
      console.error('❌ Error deleting at position:', error)
    }
  }

  /**
   * Delete a specific line
   */
  deleteLine(lineNumber: number): void {
    if (!this.editorRef.current) return

    try {
      const lines = this.editorRef.current.innerText.split('\n')
      if (lineNumber >= 0 && lineNumber < lines.length) {
        lines.splice(lineNumber, 1)
        const newContent = lines.join('\n')
        this.updateEditor(this.formatAsMarkdown(newContent))
        console.log('✅ Deleted line:', lineNumber)
      }
    } catch (error) {
      console.error('❌ Error deleting line:', error)
    }
  }

  /**
   * Delete a specific paragraph
   */
  deleteParagraph(paragraphIndex: number): void {
    if (!this.editorRef.current) return

    try {
      const paragraphs = this.editorRef.current.querySelectorAll('p')
      if (paragraphIndex >= 0 && paragraphIndex < paragraphs.length) {
        paragraphs[paragraphIndex].remove()
        this.updateEditor(this.editorRef.current.innerHTML)
        console.log('✅ Deleted paragraph:', paragraphIndex)
      }
    } catch (error) {
      console.error('❌ Error deleting paragraph:', error)
    }
  }

  /**
   * Select text in the editor
   */
  selectText(start: number, end: number): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection) return

      const range = document.createRange()
      const walker = document.createTreeWalker(
        this.editorRef.current,
        NodeFilter.SHOW_TEXT
      )

      let currentPos = 0
      let startNode: Node | null = null
      let endNode: Node | null = null
      let startOffset = 0
      let endOffset = 0

      let node
      while (node = walker.nextNode()) {
        const nodeLength = node.textContent?.length || 0
        
        if (!startNode && currentPos + nodeLength >= start) {
          startNode = node
          startOffset = start - currentPos
        }
        
        if (!endNode && currentPos + nodeLength >= end) {
          endNode = node
          endOffset = end - currentPos
          break
        }
        
        currentPos += nodeLength
      }

      if (startNode && endNode) {
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        selection.removeAllRanges()
        selection.addRange(range)
        console.log('✅ Selected text from', start, 'to', end)
      }
    } catch (error) {
      console.error('❌ Error selecting text:', error)
    }
  }

  /**
   * Select all text in the editor
   */
  selectAll(): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection) return

      const range = document.createRange()
      range.selectNodeContents(this.editorRef.current)
      selection.removeAllRanges()
      selection.addRange(range)
      console.log('✅ Selected all text')
    } catch (error) {
      console.error('❌ Error selecting all text:', error)
    }
  }

  /**
   * Get current selection
   */
  getSelection(): { text: string; start: number; end: number } | null {
    if (!this.editorRef.current) return null

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return null

      const range = selection.getRangeAt(0)
      const text = range.toString()
      
      // Calculate positions
      const startContainer = range.startContainer
      const endContainer = range.endContainer
      
      const walker = document.createTreeWalker(
        this.editorRef.current,
        NodeFilter.SHOW_TEXT
      )

      let start = 0
      let end = 0
      let currentPos = 0
      let node

      while (node = walker.nextNode()) {
        const nodeLength = node.textContent?.length || 0
        
        if (node === startContainer) {
          start = currentPos + range.startOffset
        }
        if (node === endContainer) {
          end = currentPos + range.endOffset
          break
        }
        
        currentPos += nodeLength
      }

      return { text, start, end }
    } catch (error) {
      console.error('❌ Error getting selection:', error)
      return null
    }
  }

  /**
   * Apply formatting command to the editor
   */
  applyFormat(command: string, value?: string): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      
      // Save to undo stack
      this.saveToUndoStack()

      let success = false

      switch (command) {
        case 'bold':
          success = this.toggleInlineFormat('strong', range)
          break
        case 'italic':
          success = this.toggleInlineFormat('em', range)
          break
        case 'underline':
          success = this.toggleInlineFormat('u', range)
          break
        case 'strikeThrough':
          success = this.toggleInlineFormat('s', range)
          break
        case 'subscript':
          success = this.toggleInlineFormat('sub', range)
          break
        case 'superscript':
          success = this.toggleInlineFormat('sup', range)
          break
        case 'foreColor':
          if (value) {
            success = this.applyTextColor(value, range)
          }
          break
        case 'backColor':
          if (value) {
            success = this.applyBackgroundColor(value, range)
          }
          break
        case 'fontSize':
          if (value) {
            success = this.applyFontSize(value, range)
          }
          break
        case 'fontFamily':
          if (value) {
            success = this.applyFontFamily(value, range)
          }
          break
        case 'justifyLeft':
          success = this.applyAlignment('left', range)
          break
        case 'justifyCenter':
          success = this.applyAlignment('center', range)
          break
        case 'justifyRight':
          success = this.applyAlignment('right', range)
          break
        case 'justifyFull':
          success = this.applyAlignment('justify', range)
          break
        case 'insertUnorderedList':
          success = this.applyListFormat('ul', range)
          break
        case 'insertOrderedList':
          success = this.applyListFormat('ol', range)
          break
        case 'formatBlock':
          if (value) {
            success = this.applyBlockFormat(value, range)
          }
          break
        case 'createLink':
          if (value) {
            success = this.createLink(value, range)
          }
          break
      }

      if (success) {
        this.updateEditor(this.editorRef.current.innerHTML)
        console.log('✅ Applied format:', command, value)
      }
    } catch (error) {
      console.error('❌ Error applying format:', error)
    }
  }

  /**
   * Format selected text
   */
  formatSelection(command: string, value?: string): void {
    this.applyFormat(command, value)
  }

  // Convenience methods for common formatting
  setTextColor(color: string): void {
    this.applyFormat('foreColor', color)
  }

  setBackgroundColor(color: string): void {
    this.applyFormat('backColor', color)
  }

  setFontSize(size: string): void {
    this.applyFormat('fontSize', size)
  }

  setFontFamily(family: string): void {
    this.applyFormat('fontFamily', family)
  }

  makeBold(): void {
    this.applyFormat('bold')
  }

  makeItalic(): void {
    this.applyFormat('italic')
  }

  makeUnderline(): void {
    this.applyFormat('underline')
  }

  makeStrikethrough(): void {
    this.applyFormat('strikeThrough')
  }

  makeSubscript(): void {
    this.applyFormat('subscript')
  }

  makeSuperscript(): void {
    this.applyFormat('superscript')
  }

  alignText(alignment: 'left' | 'center' | 'right' | 'justify'): void {
    this.applyFormat(`justify${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`)
  }

  createList(type: 'ordered' | 'unordered'): void {
    this.applyFormat(`insert${type === 'ordered' ? 'Ordered' : 'Unordered'}List`)
  }

  createHeading(level: 1 | 2 | 3 | 4): void {
    this.applyFormat('formatBlock', `h${level}`)
  }

  createBlockquote(): void {
    this.applyFormat('formatBlock', 'blockquote')
  }

  createCodeBlock(): void {
    this.applyFormat('formatBlock', 'pre')
  }

  createLink(url: string, text?: string): void {
    this.applyFormat('createLink', url)
  }

  /**
   * Undo the last operation
   */
  undo(): void {
    // This would need to be implemented by calling the editor's undo function
    // For now, we'll trigger the undo via keyboard shortcut
    if (this.editorRef.current) {
      const undoEvent = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true
      })
      this.editorRef.current.dispatchEvent(undoEvent)
      console.log('✅ Triggered undo via keyboard shortcut')
    }
  }

  /**
   * Redo the last undone operation
   */
  redo(): void {
    // This would need to be implemented by calling the editor's redo function
    // For now, we'll trigger the redo via keyboard shortcut
    if (this.editorRef.current) {
      const redoEvent = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true
      })
      this.editorRef.current.dispatchEvent(redoEvent)
      console.log('✅ Triggered redo via keyboard shortcut')
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    // This would need to check the editor's undo stack
    // For now, return true as a placeholder
    return true
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    // This would need to check the editor's redo stack
    // For now, return true as a placeholder
    return true
  }

  /**
   * Insert a table with specified rows and columns
   */
  insertTable(rows: number, cols: number): void {
    if (!this.editorRef.current) return

    try {
      // Check if cursor is inside a table
      if (this.isInsideTable()) {
        console.warn('Cannot insert table inside another table')
        return
      }

      this.saveToUndoStack()
      
      // Create table HTML
      let tableHTML = '<table class="editor-table" data-table="true"><tbody>'
      
      for (let i = 0; i < rows; i++) {
        tableHTML += '<tr>'
        for (let j = 0; j < cols; j++) {
          tableHTML += '<td contenteditable="true" data-table-cell="true"><br></td>'
        }
        tableHTML += '</tr>'
      }
      
      tableHTML += '</tbody></table><p><br></p>'
      
      // Insert at current cursor position or append
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.insertAdjacentHTML('afterEnd', tableHTML)
      } else {
        this.editorRef.current.insertAdjacentHTML('beforeend', tableHTML)
      }
      
      this.updateEditor(this.editorRef.current.innerHTML)
      console.log(`✅ Inserted table: ${rows}x${cols}`)
    } catch (error) {
      console.error('❌ Error inserting table:', error)
    }
  }

  /**
   * Insert a table row above or below current position
   */
  insertTableRow(position: 'above' | 'below'): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const cellElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
        ? range.commonAncestorContainer as HTMLTableCellElement
        : range.commonAncestorContainer.parentElement as HTMLTableCellElement

      if (!cellElement || !cellElement.closest('table')) return

      const row = cellElement.parentElement as HTMLTableRowElement
      const table = cellElement.closest('table') as HTMLTableElement
      if (!row || !table) return

      this.saveToUndoStack()

      const newRow = document.createElement('tr')
      const cellCount = row.cells.length
      
      for (let i = 0; i < cellCount; i++) {
        const td = document.createElement('td')
        td.setAttribute('contenteditable', 'true')
        td.setAttribute('data-table-cell', 'true')
        td.innerHTML = '&nbsp;'
        newRow.appendChild(td)
      }

      if (position === 'above') {
        row.parentNode?.insertBefore(newRow, row)
      } else {
        row.parentNode?.insertBefore(newRow, row.nextSibling)
      }

      this.updateEditor(this.editorRef.current.innerHTML)
      console.log(`✅ Inserted table row ${position}`)
    } catch (error) {
      console.error('❌ Error inserting table row:', error)
    }
  }

  /**
   * Insert a table column to the left or right of current position
   */
  insertTableColumn(position: 'left' | 'right'): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const cellElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
        ? range.commonAncestorContainer as HTMLTableCellElement
        : range.commonAncestorContainer.parentElement as HTMLTableCellElement

      if (!cellElement || !cellElement.closest('table')) return

      const row = cellElement.parentElement as HTMLTableRowElement
      const table = cellElement.closest('table') as HTMLTableElement
      if (!row || !table) return

      this.saveToUndoStack()

      const cellIndex = Array.from(row.cells).indexOf(cellElement)
      const insertIndex = position === 'left' ? cellIndex : cellIndex + 1
      
      // Insert cell in all rows
      const rows = table.querySelectorAll('tr')
      rows.forEach(tr => {
        const td = document.createElement('td')
        td.setAttribute('contenteditable', 'true')
        td.setAttribute('data-table-cell', 'true')
        td.innerHTML = '&nbsp;'
        
        if (insertIndex >= tr.children.length) {
          tr.appendChild(td)
        } else {
          tr.insertBefore(td, tr.children[insertIndex])
        }
      })

      this.updateEditor(this.editorRef.current.innerHTML)
      console.log(`✅ Inserted table column ${position}`)
    } catch (error) {
      console.error('❌ Error inserting table column:', error)
    }
  }

  /**
   * Delete the current table row
   */
  deleteTableRow(): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const cellElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
        ? range.commonAncestorContainer as HTMLTableCellElement
        : range.commonAncestorContainer.parentElement as HTMLTableCellElement

      if (!cellElement || !cellElement.closest('table')) return

      const row = cellElement.parentElement as HTMLTableRowElement
      const table = cellElement.closest('table') as HTMLTableElement
      if (!row || !table) return

      // Don't delete if it's the only row
      if (table.rows.length <= 1) {
        console.warn('Cannot delete the only row in table')
        return
      }

      this.saveToUndoStack()
      row.remove()
      this.updateEditor(this.editorRef.current.innerHTML)
      console.log('✅ Deleted table row')
    } catch (error) {
      console.error('❌ Error deleting table row:', error)
    }
  }

  /**
   * Delete the current table column
   */
  deleteTableColumn(): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const cellElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
        ? range.commonAncestorContainer as HTMLTableCellElement
        : range.commonAncestorContainer.parentElement as HTMLTableCellElement

      if (!cellElement || !cellElement.closest('table')) return

      const table = cellElement.closest('table') as HTMLTableElement
      if (!table) return

      // Don't delete if it's the only column
      if (table.rows[0]?.cells.length <= 1) {
        console.warn('Cannot delete the only column in table')
        return
      }

      this.saveToUndoStack()

      const cellIndex = Array.from((cellElement.parentElement as HTMLTableRowElement).cells).indexOf(cellElement)
      
      // Remove cell from all rows
      const rows = table.querySelectorAll('tr')
      rows.forEach(tr => {
        const cell = tr.children[cellIndex]
        if (cell) cell.remove()
      })

      this.updateEditor(this.editorRef.current.innerHTML)
      console.log('✅ Deleted table column')
    } catch (error) {
      console.error('❌ Error deleting table column:', error)
    }
  }

  /**
   * Delete the entire table
   */
  deleteTable(): void {
    if (!this.editorRef.current) return

    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const tableElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
        ? (range.commonAncestorContainer as Element).closest('table')
        : (range.commonAncestorContainer as Element).parentElement?.closest('table')

      if (!tableElement) return

      this.saveToUndoStack()
      tableElement.remove()
      this.updateEditor(this.editorRef.current.innerHTML)
      console.log('✅ Deleted table')
    } catch (error) {
      console.error('❌ Error deleting table:', error)
    }
  }

  /**
   * Check if cursor is inside a table
   */
  isInsideTable(): boolean {
    if (!this.editorRef.current) return false

    try {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const container = range.commonAncestorContainer
        const tableElement = container.nodeType === Node.ELEMENT_NODE 
          ? (container as Element).closest('table')
          : (container as Element).parentElement?.closest('table')
        
        return !!tableElement
      }
      return false
    } catch (error) {
      console.error('❌ Error checking if inside table:', error)
      return false
    }
  }

  /**
   * Type text like a human user would - character by character (simplified and reliable)
   */
  async typeText(text: string, speed: number = 50): Promise<void> {
    if (!this.editorRef.current || !text) return

    try {
      console.log('🤖 Starting live typing:', { textLength: text.length, speed })
      
      // Ensure editor is focused and editable
      this.editorRef.current.focus()
      this.ensureEditable()

      // Move cursor to end of document
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(this.editorRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)

      // Type each character with a delay to simulate human typing
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        
        // Use execCommand to insert text like a real user would
        document.execCommand('insertText', false, char)
        
        // Trigger input event to notify React of the change
        const inputEvent = new InputEvent('input', {
          data: char,
          bubbles: true,
          cancelable: true
        })
        this.editorRef.current.dispatchEvent(inputEvent)
        
        // Wait before typing the next character
        if (i < text.length - 1) {
          await new Promise(resolve => setTimeout(resolve, speed))
        }
      }
      
      console.log('✅ Live typing completed:', text.substring(0, 50) + '...')
      
      // Ensure editor remains editable after typing
      this.ensureEditable()
      
      // Focus the editor to ensure it's active
      if (this.editorRef.current) {
        this.editorRef.current.focus()
      }
    } catch (error) {
      console.error('❌ Error in live typing:', error)
      // Fallback to simple text insertion
      this.writeSimpleText(text)
    }
  }

  /**
   * Type text with formatting like a human user would
   */
  async typeWithFormatting(text: string, format?: { bold?: boolean; italic?: boolean; underline?: boolean }): Promise<void> {
    if (!this.editorRef.current || !text) return

    try {
      // Apply formatting before typing
      if (format?.bold) {
        this.makeBold()
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (format?.italic) {
        this.makeItalic()
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (format?.underline) {
        this.makeUnderline()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Type the text
      await this.typeText(text)

      // Turn off formatting after typing
      if (format?.bold) {
        this.makeBold()
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (format?.italic) {
        this.makeItalic()
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (format?.underline) {
        this.makeUnderline()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log('✅ Typed formatted text like human user')
    } catch (error) {
      console.error('❌ Error typing formatted text:', error)
    }
  }

  /**
   * Press Enter key like a human user
   */
  pressEnter(): void {
    if (!this.editorRef.current) return

    try {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true
      })
      
      this.editorRef.current.dispatchEvent(enterEvent)
      
      // Also trigger the input event
      const inputEvent = new Event('input', { bubbles: true })
      this.editorRef.current.dispatchEvent(inputEvent)
      
      console.log('✅ Pressed Enter like human user')
    } catch (error) {
      console.error('❌ Error pressing Enter:', error)
    }
  }

  /**
   * Press Tab key like a human user
   */
  pressTab(): void {
    if (!this.editorRef.current) return

    try {
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true
      })
      
      this.editorRef.current.dispatchEvent(tabEvent)
      
      console.log('✅ Pressed Tab like human user')
    } catch (error) {
      console.error('❌ Error pressing Tab:', error)
    }
  }

  /**
   * Press Backspace key like a human user
   */
  pressBackspace(): void {
    if (!this.editorRef.current) return

    try {
      const backspaceEvent = new KeyboardEvent('keydown', {
        key: 'Backspace',
        code: 'Backspace',
        bubbles: true,
        cancelable: true
      })
      
      this.editorRef.current.dispatchEvent(backspaceEvent)
      
      // Also trigger the input event
      const inputEvent = new Event('input', { bubbles: true })
      this.editorRef.current.dispatchEvent(inputEvent)
      
      console.log('✅ Pressed Backspace like human user')
    } catch (error) {
      console.error('❌ Error pressing Backspace:', error)
    }
  }

  /**
   * Press Delete key like a human user
   */
  pressDelete(): void {
    if (!this.editorRef.current) return

    try {
      const deleteEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        code: 'Delete',
        bubbles: true,
        cancelable: true
      })
      
      this.editorRef.current.dispatchEvent(deleteEvent)
      
      // Also trigger the input event
      const inputEvent = new Event('input', { bubbles: true })
      this.editorRef.current.dispatchEvent(inputEvent)
      
      console.log('✅ Pressed Delete like human user')
    } catch (error) {
      console.error('❌ Error pressing Delete:', error)
    }
  }

  /**
   * Write simple text to the editor (most reliable method)
   */
  writeSimpleText(text: string): void {
    if (!this.editorRef.current || !text) return

    try {
      console.log('🔍 Writing simple text:', text.substring(0, 50) + '...')
      
      // Ensure editor is focused and editable
      this.editorRef.current.focus()
      this.ensureEditable()
      
      // Get current content
      const currentContent = this.editorRef.current.innerHTML || ''
      
      // Add new content as a simple paragraph
      const newContent = currentContent + (currentContent ? '' : '') + `<p>${text.replace(/\n/g, '</p><p>')}</p>`
      
      // Update the editor
      this.updateEditor(newContent)
      
      console.log('✅ Simple text written successfully')
    } catch (error) {
      console.error('❌ Error writing simple text:', error)
    }
  }

  /**
   * Append simple text to the end of the editor
   */
  appendSimpleText(text: string): void {
    if (!this.editorRef.current || !text) return

    try {
      console.log('🔍 Appending simple text:', text.substring(0, 50) + '...')
      
      // Ensure editor is focused and editable
      this.editorRef.current.focus()
      this.ensureEditable()
      
      // Get current content
      const currentContent = this.editorRef.current.innerHTML || ''
      
      // Append new content
      const newContent = currentContent + (currentContent ? '<br><br>' : '') + text.replace(/\n/g, '<br>')
      
      // Update the editor
      this.updateEditor(newContent)
      
      console.log('✅ Simple text appended successfully')
    } catch (error) {
      console.error('❌ Error appending simple text:', error)
    }
  }

  /**
   * Ensure all content in the editor remains editable
   */
  ensureEditable(): void {
    if (!this.editorRef.current) return

    try {
      // Ensure the main editor is editable
      this.editorRef.current.setAttribute('contenteditable', 'true')
      this.editorRef.current.removeAttribute('readonly')
      this.editorRef.current.removeAttribute('disabled')
      
      // Ensure all child elements are editable
      const allElements = this.editorRef.current.querySelectorAll('*')
      allElements.forEach(element => {
        element.removeAttribute('readonly')
        element.removeAttribute('disabled')
        element.setAttribute('contenteditable', 'true')
      })
      
      // Focus the editor to ensure it's active
      this.editorRef.current.focus()
      
      console.log('✅ Editor content ensured to be editable')
    } catch (error) {
      console.error('❌ Error ensuring editor is editable:', error)
    }
  }

  // Helper methods for formatting
  private toggleInlineFormat(tag: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      // Check if already formatted
      const parent = range.commonAncestorContainer.parentElement
      if (parent && parent.tagName.toLowerCase() === tag) {
        // Remove formatting
        const contents = parent.innerHTML
        parent.parentNode?.replaceChild(document.createTextNode(contents), parent)
        return true
      } else {
        // Apply formatting
        const contents = range.extractContents()
        const element = document.createElement(tag)
        element.appendChild(contents)
        range.insertNode(element)
        return true
      }
    } catch (error) {
      console.error('Error toggling inline format:', error)
      return false
    }
  }

  private applyTextColor(color: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const contents = range.extractContents()
      const span = document.createElement('span')
      span.style.color = color
      span.appendChild(contents)
      range.insertNode(span)
      return true
    } catch (error) {
      console.error('Error applying text color:', error)
      return false
    }
  }

  private applyBackgroundColor(color: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const contents = range.extractContents()
      const span = document.createElement('span')
      span.style.backgroundColor = color
      span.appendChild(contents)
      range.insertNode(span)
      return true
    } catch (error) {
      console.error('Error applying background color:', error)
      return false
    }
  }

  private applyFontSize(size: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const contents = range.extractContents()
      const span = document.createElement('span')
      span.style.fontSize = size
      span.appendChild(contents)
      range.insertNode(span)
      return true
    } catch (error) {
      console.error('Error applying font size:', error)
      return false
    }
  }

  private applyFontFamily(family: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const contents = range.extractContents()
      const span = document.createElement('span')
      span.style.fontFamily = family
      span.appendChild(contents)
      range.insertNode(span)
      return true
    } catch (error) {
      console.error('Error applying font family:', error)
      return false
    }
  }

  private applyAlignment(alignment: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      // Find the paragraph containing the selection
      let element = range.commonAncestorContainer
      while (element && element.nodeType !== Node.ELEMENT_NODE) {
        element = element.parentElement
      }

      if (element) {
        // Find the block element (p, div, h1, etc.)
        while (element && !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
          element = element.parentElement
        }

        if (element) {
          (element as HTMLElement).style.textAlign = alignment
          return true
        }
      }
      return false
    } catch (error) {
      console.error('Error applying alignment:', error)
      return false
    }
  }

  private applyListFormat(type: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      // Check if already in a list
      let element = range.commonAncestorContainer
      while (element && element.nodeType !== Node.ELEMENT_NODE) {
        element = element.parentElement
      }

      if (element) {
        while (element && !['UL', 'OL', 'LI'].includes(element.tagName)) {
          element = element.parentElement
        }

        if (element && ['UL', 'OL'].includes(element.tagName)) {
          // Already in a list, remove it
          const listItems = element.querySelectorAll('li')
          listItems.forEach(li => {
            const text = li.textContent || ''
            const p = document.createElement('p')
            p.textContent = text
            li.parentNode?.replaceChild(p, li)
          })
          return true
        }
      }

      // Create new list
      const contents = range.extractContents()
      const list = document.createElement(type)
      const li = document.createElement('li')
      li.appendChild(contents)
      list.appendChild(li)
      range.insertNode(list)
      return true
    } catch (error) {
      console.error('Error applying list format:', error)
      return false
    }
  }

  private applyBlockFormat(tag: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const contents = range.extractContents()
      const element = document.createElement(tag)
      element.appendChild(contents)
      range.insertNode(element)
      return true
    } catch (error) {
      console.error('Error applying block format:', error)
      return false
    }
  }

  private createLink(url: string, range: Range): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const contents = range.extractContents()
      const link = document.createElement('a')
      link.href = url
      link.textContent = contents.textContent || url
      range.insertNode(link)
      return true
    } catch (error) {
      console.error('Error creating link:', error)
      return false
    }
  }

  private saveToUndoStack(content?: string): void {
    if (!this.editorRef.current) return
    
    const contentToSave = content || this.editorRef.current.innerHTML
    if (this.onSaveToUndoStack) {
      this.onSaveToUndoStack(contentToSave)
      console.log('💾 Saved to undo stack via callback')
    } else {
      console.log('💾 Saved to undo stack (no callback)')
    }
  }

  /**
   * Update editor content and trigger change event
   */
  private updateEditor(content: string): void {
    console.log('🔍 updateEditor called:', {
      hasEditorRef: !!this.editorRef.current,
      contentLength: content.length,
      hasOnContentChange: !!this.onContentChange
    })

    if (!this.editorRef.current) {
      console.error('❌ updateEditor: Editor reference is null')
      return
    }

    // Update the DOM directly
    this.editorRef.current.innerHTML = content
    console.log('✅ Editor innerHTML updated')
    
    // Ensure the editor remains editable by setting contentEditable
    this.editorRef.current.setAttribute('contenteditable', 'true')
    
    // Trigger input event to notify React of the change
    const inputEvent = new Event('input', { bubbles: true })
    this.editorRef.current.dispatchEvent(inputEvent)
    
    // Trigger custom content change event for the editor to listen to
    const contentChangeEvent = new CustomEvent('contentChange', { 
      detail: { content: content },
      bubbles: true 
    })
    this.editorRef.current.dispatchEvent(contentChangeEvent)
    
    // Also call the onContentChange callback for parent component
    if (this.onContentChange) {
      this.onContentChange(content)
      console.log('✅ onContentChange callback triggered')
    } else {
      console.warn('⚠️ onContentChange callback is null')
    }
    
    // Ensure focus is maintained and content is editable
    setTimeout(() => {
      if (this.editorRef.current) {
        // Make sure the editor is focused and editable
        this.editorRef.current.focus()
        
        // Ensure all content is editable by removing any readonly attributes
        const allElements = this.editorRef.current.querySelectorAll('*')
        allElements.forEach(element => {
          element.removeAttribute('readonly')
          element.removeAttribute('disabled')
          element.setAttribute('contenteditable', 'true')
        })
        
        console.log('✅ Editor content made editable')
      }
    }, 10)
  }
}

/**
 * Create an AI Editor Agent instance
 */
export function createEditorAgent(
  editorRef: React.RefObject<HTMLDivElement>, 
  onContentChange?: (content: string) => void,
  onSaveToUndoStack?: (content: string) => void
): AIEditorAgent {
  return new EditorAgent(editorRef, onContentChange, onSaveToUndoStack)
}
