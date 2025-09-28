/**
 * Utility functions for AI table editing
 */

import { TableSpec, generateTableHTML } from './table-utils'

/**
 * Detect if there are existing tables in the document content
 */
export function detectExistingTables(content: string): Array<{
  table: string
  startIndex: number
  endIndex: number
  rows: number
  cols: number
  hasHeaders: boolean
}> {
  console.log('🚨 detectExistingTables ENTRY POINT - called with content length:', content.length)
  console.log('🔍 Content preview:', content.substring(0, 1000))
  
  const tables: Array<{
    table: string
    startIndex: number
    endIndex: number
    rows: number
    cols: number
    hasHeaders: boolean
  }> = []
  
  // Find all table elements in the content - make the regex more flexible
  const tableRegex = /<table[^>]*>.*?<\/table>/gs
  let match
  
  console.log('🔍 Searching for tables in content with regex:', tableRegex)
  
  // Also try a more specific regex for editor tables
  const editorTableRegex = /<table[^>]*class="editor-table"[^>]*>.*?<\/table>/gs
  let editorMatch
  
  // First try the specific editor table regex
  while ((editorMatch = editorTableRegex.exec(content)) !== null) {
    const tableHTML = editorMatch[0]
    const startIndex = editorMatch.index
    const endIndex = editorMatch.index + tableHTML.length
    
    console.log('📋 Found editor table HTML:', tableHTML.substring(0, 200) + '...')
    
    // Count rows and columns
    const rowMatches = tableHTML.match(/<tr[^>]*>/g) || []
    const rows = rowMatches.length
    
    // Count columns by looking at the first row
    const firstRowMatch = tableHTML.match(/<tr[^>]*>.*?<\/tr>/s)
    if (firstRowMatch) {
      const cellMatches = firstRowMatch[0].match(/<(td|th)[^>]*>/g) || []
      const cols = cellMatches.length
      
      // Check if first row has headers
      const hasHeaders = firstRowMatch[0].includes('<th')
      
      console.log('📊 Editor table details:', { rows, cols, hasHeaders, startIndex, endIndex })
      
      tables.push({
        table: tableHTML,
        startIndex,
        endIndex,
        rows,
        cols,
        hasHeaders
      })
    }
  }
  
  // Then try the general table regex for any other tables
  while ((match = tableRegex.exec(content)) !== null) {
    const tableHTML = match[0]
    const startIndex = match.index
    const endIndex = match.index + tableHTML.length
    
    // Skip if we already found this table with the editor regex
    const alreadyFound = tables.some(t => t.startIndex === startIndex)
    if (alreadyFound) {
      continue
    }
    
    console.log('📋 Found general table HTML:', tableHTML.substring(0, 200) + '...')
    
    // Count rows and columns
    const rowMatches = tableHTML.match(/<tr[^>]*>/g) || []
    const rows = rowMatches.length
    
    // Count columns by looking at the first row
    const firstRowMatch = tableHTML.match(/<tr[^>]*>.*?<\/tr>/s)
    if (firstRowMatch) {
      const cellMatches = firstRowMatch[0].match(/<(td|th)[^>]*>/g) || []
      const cols = cellMatches.length
      
      // Check if first row has headers
      const hasHeaders = firstRowMatch[0].includes('<th')
      
      console.log('📊 General table details:', { rows, cols, hasHeaders, startIndex, endIndex })
      
      tables.push({
        table: tableHTML,
        startIndex,
        endIndex,
        rows,
        cols,
        hasHeaders
      })
    }
  }
  
  return tables
}

/**
 * Extract table content as a 2D array
 */
export function extractTableContent(tableHTML: string): string[][] {
  const content: string[][] = []
  
  // Extract rows
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs
  let rowMatch
  
  while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
    const rowHTML = rowMatch[1]
    const row: string[] = []
    
    // Extract cells (both td and th)
    const cellRegex = /<(td|th)[^>]*>(.*?)<\/(td|th)>/gs
    let cellMatch
    
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      const cellContent = cellMatch[2].trim()
      row.push(cellContent)
    }
    
    if (row.length > 0) {
      content.push(row)
    }
  }
  
  return content
}

/**
 * Generate table HTML from 2D content array
 */
export function generateTableFromContent(
  content: string[][],
  hasHeaders: boolean = false,
  title?: string
): string {
  if (content.length === 0) return ''
  
  console.log('🏗️ generateTableFromContent called with:', { content, hasHeaders, title })
  
  let tableHTML = ''
  
  // Add title if provided
  if (title) {
    tableHTML += `<h3>${title}</h3>\n`
  }
  
  tableHTML += '<table class="editor-table" data-table="true"><tbody>\n'
  
  content.forEach((row, rowIndex) => {
    tableHTML += '  <tr>\n'
    
    row.forEach((cell, colIndex) => {
      const cellTag = hasHeaders && rowIndex === 0 ? 'th' : 'td'
      tableHTML += `    <${cellTag} contenteditable="true" data-table-cell="true">${cell}</${cellTag}>\n`
    })
    
    tableHTML += '  </tr>\n'
  })
  
  tableHTML += '</tbody></table>\n'
  
  console.log('🏗️ Generated table HTML preview:', tableHTML.substring(0, 300))
  
  return tableHTML
}

/**
 * Parse table editing request
 */
export function parseTableEditRequest(message: string, existingTables: Array<{
  table: string
  startIndex: number
  endIndex: number
  rows: number
  cols: number
  hasHeaders: boolean
}>): {
  action: 'add_row' | 'add_column' | 'remove_row' | 'remove_column' | 'edit_cell' | 'replace_table' | 'delete_table' | 'modify_table'
  tableIndex?: number
  rowIndex?: number
  colIndex?: number
  newContent?: string
  newTableSpec?: TableSpec
} | null {
  const lowerMessage = message.toLowerCase()
  
  // Check for table deletion
  if (lowerMessage.includes('delete table') || lowerMessage.includes('remove table')) {
    return { action: 'delete_table', tableIndex: 0 } // Default to first table
  }
  
  // Check for adding rows
  if (lowerMessage.includes('add row') || lowerMessage.includes('insert row')) {
    const rowIndex = extractNumber(lowerMessage, 'row') || 0
    return { action: 'add_row', rowIndex }
  }
  
  // Check for adding columns
  if (lowerMessage.includes('add column') || lowerMessage.includes('insert column')) {
    const colIndex = extractNumber(lowerMessage, 'column') || 0
    return { action: 'add_column', colIndex }
  }
  
  // Check for removing rows
  if (lowerMessage.includes('remove row') || lowerMessage.includes('delete row')) {
    const rowIndex = extractNumber(lowerMessage, 'row') || 0
    return { action: 'remove_row', rowIndex }
  }
  
  // Check for removing columns
  if (lowerMessage.includes('remove column') || lowerMessage.includes('delete column')) {
    const colIndex = extractNumber(lowerMessage, 'column') || 0
    return { action: 'remove_column', colIndex }
  }
  
  // Check for cell editing
  if (lowerMessage.includes('edit cell') || lowerMessage.includes('change cell') || lowerMessage.includes('update cell')) {
    const rowIndex = extractNumber(lowerMessage, 'row') || 0
    const colIndex = extractNumber(lowerMessage, 'column') || 0
    return { action: 'edit_cell', rowIndex, colIndex }
  }
  
  // Check for table replacement
  if (lowerMessage.includes('replace table') || lowerMessage.includes('update table')) {
    const { parseTableRequest } = require('./table-utils')
    const newTableSpec = parseTableRequest(message)
    if (newTableSpec) {
      return { action: 'replace_table', newTableSpec }
    }
  }
  
  // Check for general table modification (like "change table to numbers only", "make table bigger", etc.)
  if (lowerMessage.includes('table') && (lowerMessage.includes('change') || lowerMessage.includes('modify') || lowerMessage.includes('update') || lowerMessage.includes('make') || lowerMessage.includes('edit'))) {
    // Check for specific table index (first, second, etc.)
    let tableIndex = 0 // Default to first table
    
    // Check for ordinal numbers (1st, 2nd, 3rd, etc.)
    const ordinalMatch = lowerMessage.match(/(\d+)(?:st|nd|rd|th)?\s+table/)
    if (ordinalMatch) {
      const ordinalNumber = parseInt(ordinalMatch[1])
      tableIndex = Math.max(0, ordinalNumber - 1) // Convert to 0-based index
    }
    // Check for written numbers (first, second, third, etc.)
    else if (lowerMessage.includes('first table') || lowerMessage.includes('1st table')) {
      tableIndex = 0
    } else if (lowerMessage.includes('second table') || lowerMessage.includes('2nd table')) {
      tableIndex = 1
    } else if (lowerMessage.includes('third table') || lowerMessage.includes('3rd table')) {
      tableIndex = 2
    } else if (lowerMessage.includes('fourth table') || lowerMessage.includes('4th table')) {
      tableIndex = 3
    } else if (lowerMessage.includes('last table')) {
      tableIndex = existingTables.length - 1
    }
    
    console.log('🎯 Table index detection:', { 
      lowerMessage, 
      tableIndex, 
      totalTables: existingTables.length,
      ordinalMatch: ordinalMatch?.[1]
    })
    
    return { action: 'modify_table', tableIndex, newContent: message }
  }
  
  return null
}

/**
 * Extract number from text (e.g., "row 3" -> 3)
 */
function extractNumber(text: string, keyword: string): number | null {
  const regex = new RegExp(`${keyword}\\s+(\\d+)`, 'i')
  const match = text.match(regex)
  return match ? parseInt(match[1]) - 1 : null // Convert to 0-based index
}

/**
 * Apply table edit operation
 */
export function applyTableEdit(
  tableHTML: string,
  editRequest: {
    action: 'add_row' | 'add_column' | 'remove_row' | 'remove_column' | 'edit_cell' | 'replace_table' | 'delete_table' | 'modify_table'
    rowIndex?: number
    colIndex?: number
    newContent?: string
    newTableSpec?: TableSpec
  }
): string {
  const content = extractTableContent(tableHTML)
  const hasHeaders = tableHTML.includes('<th')
  
  switch (editRequest.action) {
    case 'add_row':
      const newRowIndex = editRequest.rowIndex ?? content.length
      const newRow = Array(content[0]?.length || 1).fill('New Cell')
      content.splice(newRowIndex, 0, newRow)
      break
      
    case 'add_column':
      const newColIndex = editRequest.colIndex ?? (content[0]?.length || 0)
      content.forEach(row => {
        row.splice(newColIndex, 0, 'New Cell')
      })
      break
      
    case 'remove_row':
      const removeRowIndex = editRequest.rowIndex ?? content.length - 1
      if (content.length > 1) {
        content.splice(removeRowIndex, 1)
      }
      break
      
    case 'remove_column':
      const removeColIndex = editRequest.colIndex ?? (content[0]?.length - 1 || 0)
      if (content[0] && content[0].length > 1) {
        content.forEach(row => {
          row.splice(removeColIndex, 1)
        })
      }
      break
      
    case 'edit_cell':
      const editRowIndex = editRequest.rowIndex ?? 0
      const editColIndex = editRequest.colIndex ?? 0
      if (content[editRowIndex] && content[editRowIndex][editColIndex] !== undefined) {
        content[editRowIndex][editColIndex] = editRequest.newContent || 'Updated Cell'
      }
      break
      
    case 'replace_table':
      if (editRequest.newTableSpec) {
        return generateTableHTML(editRequest.newTableSpec)
      }
      break
      
    case 'delete_table':
      return ''
      
    case 'modify_table':
      // For general table modifications, we'll use AI to understand the request
      // and modify the table content accordingly
      console.log('🔧 applyTableEdit: Calling modifyTableWithAI with:', { 
        newContent: editRequest.newContent, 
        tableHTMLPreview: tableHTML.substring(0, 200) 
      })
      // Note: This will need to be handled asynchronously in the calling code
      throw new Error('modify_table requires async handling - use processTableEditRequest instead')
  }
  
  return generateTableFromContent(content, hasHeaders)
}

/**
 * Modify table using AI to understand the request
 */
async function modifyTableWithAI(tableHTML: string, userRequest: string): Promise<string> {
  console.log('🔧 modifyTableWithAI called with:', { userRequest, tableHTMLPreview: tableHTML.substring(0, 200) })
  
  // Extract the table content
  const content = extractTableContent(tableHTML)
  const hasHeaders = tableHTML.includes('<th')
  
  console.log('📊 Extracted table content:', { content, hasHeaders, rows: content.length, cols: content[0]?.length })
  
  try {
    // Use AI to understand and modify the table content
    const { generateChatCompletion } = await import('./openai')
    
    const messages = [
      {
        role: 'system' as const,
        content: `You are an AI assistant that modifies table content based on user requests.

Current table content (as a 2D array):
${JSON.stringify(content, null, 2)}

Table has headers: ${hasHeaders}
Table dimensions: ${content.length} rows × ${content[0]?.length || 0} columns

Your task: Modify the table content according to the user's request and return ONLY the modified 2D array in JSON format.

Rules:
1. Return ONLY the JSON array, no explanations or other text
2. Preserve the same dimensions (${content.length} rows × ${content[0]?.length || 0} columns)
3. If the table has headers (first row), preserve them unless explicitly asked to change them
4. Fill cells with the requested content (numbers, letters, etc.)
5. If the request asks for a sequence (like 1-9 or A-I), fill cells sequentially

Example responses:
- For "fill with numbers 1-9": [["1","2","3"],["4","5","6"],["7","8","9"]]
- For "fill with letters A-I": [["A","B","C"],["D","E","F"],["G","H","I"]]`
      },
      {
        role: 'user' as const,
        content: userRequest
      }
    ]
    
    console.log('🤖 Calling AI to modify table content...')
    
    const response = await generateChatCompletion(messages, {
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo',
      temperature: 0.3,
      max_tokens: 500
    })
    
    const aiResponse = response.choices[0]?.message?.content?.trim()
    console.log('🤖 AI response:', aiResponse)
    
    if (!aiResponse) {
      throw new Error('No response from AI')
    }
    
    // Parse the AI response as JSON
    const modifiedContent = JSON.parse(aiResponse)
    console.log('✅ AI modified content:', modifiedContent)
    
    // Validate the response has the correct dimensions
    if (!Array.isArray(modifiedContent) || modifiedContent.length !== content.length) {
      throw new Error('AI response has incorrect number of rows')
    }
    
    if (modifiedContent[0] && modifiedContent[0].length !== content[0]?.length) {
      throw new Error('AI response has incorrect number of columns')
    }
    
    const result = generateTableFromContent(modifiedContent, hasHeaders)
    console.log('🎯 Generated table HTML preview:', result.substring(0, 300))
    return result
    
  } catch (error) {
    console.error('❌ AI table modification failed:', error)
    console.log('⚠️ Falling back to original table')
    return tableHTML
  }
}

/**
 * Process table editing request for existing tables
 */
export async function processTableEditRequest(
  message: string,
  documentContent: string
): Promise<{
  isTableEdit: boolean
  editedContent: string
  tableIndex?: number
}> {
  console.log('🚨 processTableEditRequest ENTRY POINT - called with:', { message, contentLength: documentContent.length })
  
  const existingTables = detectExistingTables(documentContent)
  console.log('📊 Found existing tables:', existingTables.length)
  
  if (existingTables.length === 0) {
    console.log('❌ No tables found in document')
    return { isTableEdit: false, editedContent: documentContent }
  }
  
  const editRequest = parseTableEditRequest(message, existingTables)
  console.log('🎯 Parsed edit request:', editRequest)
  
  if (!editRequest) {
    console.log('❌ No edit request detected')
    return { isTableEdit: false, editedContent: documentContent }
  }
  
  // Apply the edit to the first table (or specified table)
  const tableIndex = editRequest.tableIndex ?? 0
  const tableToEdit = existingTables[tableIndex]
  
  if (!tableToEdit) {
    console.log('❌ Table not found at index:', tableIndex)
    return { isTableEdit: false, editedContent: documentContent }
  }
  
  console.log('✏️ Applying edit to table:', { action: editRequest.action, tableSize: `${tableToEdit.rows}x${tableToEdit.cols}` })
  
  let editedTable: string
  
  if (editRequest.action === 'modify_table') {
    // Handle async AI-powered table modification
    editedTable = await modifyTableWithAI(tableToEdit.table, editRequest.newContent || '')
  } else {
    // Handle synchronous table operations
    editedTable = applyTableEdit(tableToEdit.table, editRequest)
  }
  
  // Replace the table in the document content
  const beforeTable = documentContent.substring(0, tableToEdit.startIndex)
  const afterTable = documentContent.substring(tableToEdit.endIndex)
  const editedContent = beforeTable + editedTable + afterTable
  
  console.log('✅ Table edit completed:', { 
    originalLength: documentContent.length, 
    editedLength: editedContent.length,
    tableChanged: tableToEdit.table !== editedTable,
    originalTable: tableToEdit.table.substring(0, 100) + '...',
    editedTable: editedTable.substring(0, 100) + '...'
  })
  
  return {
    isTableEdit: true,
    editedContent,
    tableIndex
  }
}
