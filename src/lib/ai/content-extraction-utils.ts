/**
 * Content Extraction Utilities
 * Centralized functions for extracting and processing content for live editing
 */

/**
 * Extract content for live editing from AI response
 * This is the centralized implementation to avoid duplicates
 */
export function extractContentForLiveEdit(content: string): string {
  console.log('🔍 Extracting content for live edit:', {
    contentLength: content.length,
    contentPreview: content.substring(0, 200) + '...'
  })
  
  // Look for content after common phrases with better regex patterns
  const patterns = [
    /I'll write[:\s]*\n?(.+)/is,
    /I'm writing[:\s]*\n?(.+)/is,
    /Let me write[:\s]*\n?(.+)/is,
    /Here's the[:\s]*\n?(.+)/is,
    /Here is the[:\s]*\n?(.+)/is,
    /I'll create[:\s]*\n?(.+)/is,
    /I'm creating[:\s]*\n?(.+)/is,
    /I'll add[:\s]*\n?(.+)/is,
    /I'm adding[:\s]*\n?(.+)/is,
    /Let me add[:\s]*\n?(.+)/is,
    /I'll insert[:\s]*\n?(.+)/is,
    /I'm inserting[:\s]*\n?(.+)/is,
    /Writing[:\s]*\n?(.+)/is,
    /Creating[:\s]*\n?(.+)/is,
    /Adding[:\s]*\n?(.+)/is,
    /I'll provide[:\s]*\n?(.+)/is,
    /I'm providing[:\s]*\n?(.+)/is,
    /Let me provide[:\s]*\n?(.+)/is
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      console.log('🔍 Pattern match found:', {
        pattern: pattern.toString(),
        extractedLength: extracted.length,
        extractedPreview: extracted.substring(0, 100) + '...'
      })
      // Only return if we have substantial content (more than just a few words)
      if (extracted.length > 20) {
        console.log('✅ Returning extracted content from pattern')
        return extracted
      }
    }
  }
  
  // If no pattern matches, check if it's structured content (report/document)
  const isStructured = content.length > 500 && (
    content.includes('#') || 
    content.includes('##') || 
    content.includes('**') || 
    content.includes('1.') || 
    content.includes('- ') || 
    content.includes('|')
  )
  
  console.log('🔍 Structured content check:', {
    isStructured,
    contentLength: content.length,
    hasHeaders: content.includes('#'),
    hasSubheaders: content.includes('##'),
    hasBold: content.includes('**'),
    hasNumbered: content.includes('1.'),
    hasBullets: content.includes('- '),
    hasTables: content.includes('|')
  })
  
  if (isStructured) {
    // For structured content, return the entire content
    console.log('✅ Returning full content as structured content')
    return content
  }
  
  // If no pattern matches and content is substantial, return as-is
  if (content.length > 100) {
    console.log('✅ Returning full content as substantial content')
    return content
  }
  
  // Return empty string if content is too short or doesn't match patterns
  console.log('❌ No content extracted - too short or no patterns matched')
  return ''
}

/**
 * Extract text content from document JSON content
 * Centralized implementation to avoid duplicates
 */
export function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content
  }

  if (typeof content === 'object' && content !== null) {
    // Handle different content structures
    if (content.html) {
      return stripHtml(content.html)
    }
    
    if (content.plainText) {
      return content.plainText
    }

    if (content.text) {
      return content.text
    }

    // If it's an array of content blocks
    if (Array.isArray(content)) {
      return content
        .map(block => {
          if (typeof block === 'string') return block
          if (block.text) return block.text
          if (block.content) return block.content
          return ''
        })
        .join('\n')
    }

    // Try to extract text from any nested structure
    return JSON.stringify(content)
  }

  return ''
}

/**
 * Strip HTML tags from text, excluding image data
 * Centralized implementation to avoid duplicates
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, ' ') // Remove img tags and their content
    .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Extract content from enhanced preview operations
 * New function to handle structured operations
 */
export function extractContentFromEnhancedOps(ops: any[]): string {
  console.log('🔍 Extracting content from enhanced operations:', {
    opsCount: ops.length,
    opsTypes: ops.map(op => op.op)
  })

  const contentParts: string[] = []

  ops.forEach(op => {
    switch (op.op) {
      case 'insert_after':
      case 'insert_before':
      case 'replace_range':
        if (op.text) {
          contentParts.push(op.text)
        }
        break
      
      case 'create_heading':
        if (op.text) {
          const level = op.structure?.level || 1
          const headingPrefix = '#'.repeat(level) + ' '
          contentParts.push(headingPrefix + op.text)
        }
        break
      
      case 'create_list':
        if (op.listItems && Array.isArray(op.listItems)) {
          const listPrefix = op.listType === 'ordered' ? '1.' : '-'
          op.listItems.forEach((item: string, index: number) => {
            const prefix = op.listType === 'ordered' ? `${index + 1}.` : '-'
            contentParts.push(`${prefix} ${item}`)
          })
        }
        break
      
      case 'create_table':
        if (op.tableData && Array.isArray(op.tableData)) {
          // Generate markdown table
          if (op.tableHeaders && op.tableHeaders.length > 0) {
            contentParts.push(op.tableHeaders.join(' | '))
            contentParts.push(op.tableHeaders.map(() => '---').join(' | '))
          }
          op.tableData.forEach((row: string[]) => {
            contentParts.push(row.join(' | '))
          })
        }
        break
      
      case 'format_text':
        if (op.text) {
          let formattedText = op.text
          if (op.structure?.style === 'bold') {
            formattedText = `**${formattedText}**`
          } else if (op.structure?.style === 'italic') {
            formattedText = `*${formattedText}*`
          }
          contentParts.push(formattedText)
        }
        break
    }
  })

  const extractedContent = contentParts.join('\n\n')
  console.log('✅ Extracted content from enhanced operations:', {
    contentLength: extractedContent.length,
    contentPreview: extractedContent.substring(0, 100) + '...'
  })

  return extractedContent
}

/**
 * Check if content should trigger live editing
 * Centralized implementation
 */
export function shouldTriggerLiveEdit(content: string, task: string): boolean {
  // Only allow live editing when task is explicitly a writing action
  const isWritingTask = task === 'write' || 
    ['create', 'generate', 'compose', 'draft', 'report', 'document', 'add', 'insert', 'extend', 'rewrite'].some((w) => 
      task.toLowerCase().includes(w)
    )

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
  if (isWritingTask) {
    return true
  }

  // For other requests, check if content has trigger phrases or is structured
  return hasTriggerPhrase || isStructuredContent || isReportRequest
}
