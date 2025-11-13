/**
 * Utility functions for formatting AI-generated content
 */

/**
 * Format AI content from markdown-like text to properly formatted HTML
 */
export function formatAIContent(content: string): string {
  if (!content || content.includes('<')) {
    return content
  }

  let formattedContent = content
  
  // Convert headings
  formattedContent = formattedContent.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  formattedContent = formattedContent.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  formattedContent = formattedContent.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  
  // Convert bullet points
  formattedContent = formattedContent.replace(/^- (.+)$/gm, '<li>$1</li>')
  formattedContent = formattedContent.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
  
  // Convert numbered lists
  formattedContent = formattedContent.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  formattedContent = formattedContent.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>')
  
  // Convert bold text
  formattedContent = formattedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  
  // Convert italic text
  formattedContent = formattedContent.replace(/\*(.+?)\*/g, '<em>$1</em>')
  
  // Split by double newlines to create paragraphs
  const sections = formattedContent.split(/\n\s*\n/).filter(s => s.trim())
  const processedSections = sections.map(section => {
    const trimmed = section.trim()
    
    // Skip if already an HTML element
    if (trimmed.startsWith('<h1>') || trimmed.startsWith('<h2>') || trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>')) {
      return trimmed
    }
    
    // Wrap in paragraph if not already wrapped
    if (!trimmed.startsWith('<p>') && !trimmed.startsWith('<li>')) {
      return `<p>${trimmed}</p>`
    }
    
    return trimmed
  })
  
  formattedContent = processedSections.join('')
  
  // Handle single newlines as line breaks
  formattedContent = formattedContent.replace(/\n/g, '<br>')
  
  // Ensure content is wrapped if it doesn't start with a tag
  if (!formattedContent.startsWith('<')) {
    formattedContent = `<p>${formattedContent}</p>`
  }
  
  return formattedContent
}

