import { generateChatCompletion, ChatMessage } from './openai'
import { prisma } from '@/lib/prisma'

export interface DocumentAnalysis {
  documentType: 'text' | 'table' | 'list' | 'mixed' | 'empty'
  hasTables: boolean
  hasLists: boolean
  hasStructuredData: boolean
  contentStructure: string[]
  keyTopics: string[]
  suggestedActions: string[]
  contextSummary: string
  editingRecommendations: string[]
}

/**
 * Analyze document context using LLM to better understand content structure
 */
export async function analyzeDocumentContext(
  documentId: string,
  userId: string,
  userQuery?: string
): Promise<DocumentAnalysis | null> {
  try {
    // Get document content
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        content: true,
        plainText: true
      }
    })

    if (!document) {
      return null
    }

    const content = document.plainText || extractTextFromContent(document.content)
    
    if (!content || content.trim().length === 0) {
      return {
        documentType: 'empty',
        hasTables: false,
        hasLists: false,
        hasStructuredData: false,
        contentStructure: [],
        keyTopics: [],
        suggestedActions: ['Add content to get started'],
        contextSummary: 'Empty document',
        editingRecommendations: ['Consider adding an introduction or outline']
      }
    }

    // Use LLM to analyze the document content
    const analysisPrompt = buildDocumentAnalysisPrompt(content, userQuery)
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert document analyzer. Analyze the provided document content and provide a structured analysis in JSON format. Focus on understanding the document structure, content type, and providing actionable insights for editing and improvement.`
      },
      {
        role: 'user',
        content: analysisPrompt
      }
    ]

    const response = await generateChatCompletion(messages, {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 1000
    })

    // Parse the LLM response
    const analysis = parseDocumentAnalysis(response, content)
    
    console.log('📊 Document Analysis:', {
      documentId,
      documentType: analysis.documentType,
      hasTables: analysis.hasTables,
      keyTopics: analysis.keyTopics.slice(0, 3),
      contextSummary: analysis.contextSummary.substring(0, 100) + '...'
    })

    return analysis

  } catch (error) {
    console.error('Error analyzing document context:', error)
    return null
  }
}

/**
 * Build prompt for document analysis
 */
function buildDocumentAnalysisPrompt(content: string, userQuery?: string): string {
  const queryContext = userQuery ? `\n\nUser Query: "${userQuery}"` : ''
  
  return `Analyze this document content and provide a JSON response with the following structure:

{
  "documentType": "text|table|list|mixed|empty",
  "hasTables": boolean,
  "hasLists": boolean,
  "hasStructuredData": boolean,
  "contentStructure": ["array of structural elements found"],
  "keyTopics": ["array of main topics/themes"],
  "suggestedActions": ["array of suggested editing actions"],
  "contextSummary": "brief summary of document content and purpose",
  "editingRecommendations": ["array of specific editing recommendations"]
}

Document Content:
${content.substring(0, 4000)}${content.length > 4000 ? '...' : ''}${queryContext}

Focus on:
1. Identifying the document structure and content type
2. Detecting tables, lists, and structured data
3. Understanding the main topics and themes
4. Providing actionable editing suggestions
5. Considering the user's query if provided

Return only valid JSON.`
}

/**
 * Parse LLM response into DocumentAnalysis object
 */
function parseDocumentAnalysis(response: string, content: string): DocumentAnalysis {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        documentType: parsed.documentType || 'text',
        hasTables: parsed.hasTables || false,
        hasLists: parsed.hasLists || false,
        hasStructuredData: parsed.hasStructuredData || false,
        contentStructure: parsed.contentStructure || [],
        keyTopics: parsed.keyTopics || [],
        suggestedActions: parsed.suggestedActions || [],
        contextSummary: parsed.contextSummary || 'Document analysis completed',
        editingRecommendations: parsed.editingRecommendations || []
      }
    }
  } catch (error) {
    console.warn('Failed to parse LLM analysis response:', error)
  }

  // Fallback analysis based on content patterns
  return createFallbackAnalysis(content)
}

/**
 * Create fallback analysis when LLM parsing fails
 */
function createFallbackAnalysis(content: string): DocumentAnalysis {
  const hasTables = /<table|<thead|<tbody|<tr|<td|<th/.test(content)
  const hasLists = /<ul|<ol|<li|^\s*[-*+]\s|^\s*\d+\.\s/.test(content)
  const hasStructuredData = hasTables || hasLists || /\|\s*/.test(content)
  
  // Detect document type
  let documentType: DocumentAnalysis['documentType'] = 'text'
  if (hasTables && !hasLists) documentType = 'table'
  else if (hasLists && !hasTables) documentType = 'list'
  else if (hasTables && hasLists) documentType = 'mixed'
  
  // Extract key topics (simple keyword extraction)
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4)
    .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other', 'after', 'first', 'well', 'also', 'where', 'much', 'some', 'very', 'when', 'here', 'just', 'into', 'over', 'think', 'more', 'your', 'work', 'know', 'take', 'than', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'has', 'had', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word))
  
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const keyTopics = Object.entries(wordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word)

  return {
    documentType,
    hasTables,
    hasLists,
    hasStructuredData,
    contentStructure: hasTables ? ['tables'] : hasLists ? ['lists'] : ['text'],
    keyTopics,
    suggestedActions: hasTables ? ['Edit existing tables', 'Add new content'] : ['Add structured content', 'Create tables or lists'],
    contextSummary: `Document contains ${documentType} content with ${keyTopics.length > 0 ? 'topics: ' + keyTopics.slice(0, 3).join(', ') : 'various content'}`,
    editingRecommendations: hasTables ? ['Consider table formatting', 'Add more data rows'] : ['Add structure', 'Consider using tables for data']
  }
}

/**
 * Extract text content from document JSON content
 */
function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content.map(item => extractTextFromContent(item)).join(' ')
  }

  if (content && typeof content === 'object') {
    if (content.type === 'doc' && content.content) {
      return extractTextFromContent(content.content)
    }
    
    if (content.text) {
      return extractTextFromContent(content.text)
    }
    
    if (content.content) {
      return extractTextFromContent(content.content)
    }
    
    // Handle ProseMirror document structure
    if (content.type && content.content) {
      return extractTextFromContent(content.content)
    }
  }

  return ''
}

/**
 * Get enhanced context for editing decisions
 */
export async function getEnhancedEditingContext(
  documentId: string,
  userId: string,
  userQuery: string
): Promise<{
  documentAnalysis: DocumentAnalysis | null
  contextSummary: string
  editingSuggestions: string[]
}> {
  const analysis = await analyzeDocumentContext(documentId, userId, userQuery)
  
  if (!analysis) {
    return {
      documentAnalysis: null,
      contextSummary: 'Unable to analyze document context',
      editingSuggestions: ['Please provide more specific instructions']
    }
  }

  // Generate context-aware editing suggestions
  const editingSuggestions = generateContextAwareSuggestions(analysis, userQuery)
  
  const contextSummary = `Document Analysis: ${analysis.contextSummary}. Document type: ${analysis.documentType}. ${analysis.hasTables ? 'Contains tables. ' : ''}${analysis.hasLists ? 'Contains lists. ' : ''}Key topics: ${analysis.keyTopics.slice(0, 3).join(', ')}.`

  return {
    documentAnalysis: analysis,
    contextSummary,
    editingSuggestions
  }
}

/**
 * Generate context-aware editing suggestions
 */
function generateContextAwareSuggestions(analysis: DocumentAnalysis, userQuery: string): string[] {
  const suggestions: string[] = []
  const lowerQuery = userQuery.toLowerCase()

  // Table-related suggestions
  if (lowerQuery.includes('table') || lowerQuery.includes('data')) {
    if (analysis.hasTables) {
      suggestions.push('Edit existing table structure or content')
      suggestions.push('Add new rows or columns to existing tables')
    } else {
      suggestions.push('Create a new table for structured data')
      suggestions.push('Convert existing content to table format')
    }
  }

  // Content structure suggestions
  if (analysis.documentType === 'text' && !analysis.hasStructuredData) {
    suggestions.push('Add structured elements like lists or tables')
    suggestions.push('Organize content with headings and sections')
  }

  // Topic-based suggestions
  if (analysis.keyTopics.length > 0) {
    suggestions.push(`Expand on topics: ${analysis.keyTopics.slice(0, 2).join(', ')}`)
    suggestions.push('Add supporting details and examples')
  }

  // General editing suggestions
  suggestions.push('Improve content clarity and flow')
  suggestions.push('Add relevant examples or case studies')

  return suggestions.slice(0, 4) // Limit to 4 suggestions
}
