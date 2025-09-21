/**
 * Utility functions for AI table generation and editing
 */

export interface TableSpec {
  rows: number
  cols: number
  hasHeaders?: boolean
  content?: string[][]
  title?: string
}

/**
 * Generate HTML table markup for the editor
 */
export function generateTableHTML(spec: TableSpec): string {
  const { rows, cols, hasHeaders = false, content, title } = spec
  
  let tableHTML = ''
  
  // Add title if provided
  if (title) {
    tableHTML += `<h3>${title}</h3>\n`
  }
  
  tableHTML += '<table class="editor-table" data-table="true"><tbody>\n'
  
  for (let i = 0; i < rows; i++) {
    tableHTML += '  <tr>\n'
    
    for (let j = 0; j < cols; j++) {
      const cellContent = content?.[i]?.[j] || ''
      const cellTag = hasHeaders && i === 0 ? 'th' : 'td'
      
      tableHTML += `    <${cellTag} contenteditable="true" data-table-cell="true">${cellContent}</${cellTag}>\n`
    }
    
    tableHTML += '  </tr>\n'
  }
  
  tableHTML += '</tbody></table>\n'
  
  return tableHTML
}

/**
 * Parse table request from user message
 */
export function parseTableRequest(message: string): TableSpec | null {
  const lowerMessage = message.toLowerCase()
  
  // Extract dimensions from common patterns
  const dimensionPatterns = [
    /(\d+)\s*[x×]\s*(\d+)/,  // "3x4", "3 x 4", "3×4"
    /(\d+)\s+by\s+(\d+)/,    // "3 by 4"
    /(\d+)\s+rows?\s+and\s+(\d+)\s+columns?/,  // "3 rows and 4 columns"
    /(\d+)\s+columns?\s+and\s+(\d+)\s+rows?/,  // "4 columns and 3 rows"
    /table\s+with\s+(\d+)\s+rows?\s+and\s+(\d+)\s+columns?/,  // "table with 3 rows and 4 columns"
  ]
  
  let rows = 3
  let cols = 3
  let hasHeaders = false
  let title = ''
  
  // Try to extract dimensions
  for (const pattern of dimensionPatterns) {
    const match = lowerMessage.match(pattern)
    if (match) {
      const firstNum = parseInt(match[1])
      const secondNum = parseInt(match[2])
      
      // Determine which is rows and which is columns
      if (lowerMessage.includes('column') && lowerMessage.indexOf('column') < lowerMessage.indexOf('row')) {
        cols = firstNum
        rows = secondNum
      } else {
        rows = firstNum
        cols = secondNum
      }
      break
    }
  }
  
  // Check for headers
  if (lowerMessage.includes('header') || lowerMessage.includes('headings')) {
    hasHeaders = true
  }
  
  // Extract title if present
  const titleMatch = lowerMessage.match(/table\s+(?:for|about|on)\s+(.+?)(?:\s+with|\s+that|\s+showing|$)/)
  if (titleMatch) {
    title = titleMatch[1].trim()
  }
  
  // Generate content based on context
  const content = generateTableContent(rows, cols, title, lowerMessage)
  
  return {
    rows,
    cols,
    hasHeaders,
    content,
    title
  }
}

/**
 * Generate appropriate content for table cells
 */
function generateTableContent(rows: number, cols: number, title: string, message: string): string[][] {
  const content: string[][] = []
  
  // Check for reverse alphabet sequences (e.g., "I to A", "Z to A", etc.)
  if (message.toLowerCase().includes('letters') && message.toLowerCase().includes('i') && message.toLowerCase().includes('a') && message.toLowerCase().includes('order')) {
    return generateReverseAlphabetTable(rows, cols, title, message)
  }
  
  // Check for specific number sequences (e.g., "numbers 1-9", "1 through 9", etc.)
  if (message.includes('number') && message.includes('1') && message.includes('9')) {
    return generateNumberSequenceTable(rows, cols, title, message)
  }
  
  // Check for other number patterns
  const numberRangeMatch = message.match(/(\d+)\s*(?:to|through|-)\s*(\d+)/)
  if (numberRangeMatch) {
    const startNum = parseInt(numberRangeMatch[1])
    const endNum = parseInt(numberRangeMatch[2])
    return generateNumberSequenceTable(rows, cols, title, message, startNum, endNum)
  }
  
  // Check for specific number patterns like "1-9", "1,2,3,4,5,6,7,8,9"
  if (message.match(/[\d\s,-]+/) && (message.includes('1') && message.includes('9'))) {
    return generateNumberSequenceTable(rows, cols, title, message)
  }
  
  // Common table types based on keywords
  if (message.includes('comparison') || message.includes('compare')) {
    return generateComparisonTable(rows, cols, title)
  } else if (message.includes('schedule') || message.includes('timeline')) {
    return generateScheduleTable(rows, cols, title)
  } else if (message.includes('budget') || message.includes('cost') || message.includes('financial')) {
    return generateBudgetTable(rows, cols, title)
  } else if (message.includes('inventory') || message.includes('stock') || message.includes('items')) {
    return generateInventoryTable(rows, cols, title)
  } else if (message.includes('contact') || message.includes('directory') || message.includes('people')) {
    return generateContactTable(rows, cols, title)
  } else if (message.includes('data') || message.includes('statistics') || message.includes('metrics')) {
    return generateDataTable(rows, cols, title)
  } else {
    return generateGenericTable(rows, cols, title)
  }
}

function generateComparisonTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(`Feature ${j + 1}`)
      } else if (j === 0) {
        row.push(`Option ${i}`)
      } else {
        row.push('Value')
      }
    }
    content.push(row)
  }
  
  return content
}

function generateScheduleTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(j === 0 ? 'Time' : `Day ${j}`)
      } else if (j === 0) {
        row.push(`${9 + i}:00`)
      } else {
        row.push('Activity')
      }
    }
    content.push(row)
  }
  
  return content
}

function generateBudgetTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(j === 0 ? 'Category' : `Month ${j}`)
      } else if (j === 0) {
        row.push(`Item ${i}`)
      } else {
        row.push('$0.00')
      }
    }
    content.push(row)
  }
  
  return content
}

function generateInventoryTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(j === 0 ? 'Item' : j === 1 ? 'Quantity' : j === 2 ? 'Price' : 'Status')
      } else {
        row.push(j === 0 ? `Item ${i}` : j === 1 ? '0' : j === 2 ? '$0.00' : 'In Stock')
      }
    }
    content.push(row)
  }
  
  return content
}

function generateContactTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(j === 0 ? 'Name' : j === 1 ? 'Email' : j === 2 ? 'Phone' : 'Department')
      } else {
        row.push(j === 0 ? `Person ${i}` : j === 1 ? 'email@example.com' : j === 2 ? '(555) 000-0000' : 'Department')
      }
    }
    content.push(row)
  }
  
  return content
}

function generateDataTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(`Metric ${j + 1}`)
      } else {
        row.push(`${Math.floor(Math.random() * 100)}`)
      }
    }
    content.push(row)
  }
  
  return content
}

function generateReverseAlphabetTable(rows: number, cols: number, title: string, message: string): string[][] {
  const content: string[][] = []
  const totalCells = rows * cols
  
  // Generate reverse alphabet sequence I to A
  const alphabet = ['I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']
  
  // Fill table with reverse alphabet sequence
  let alphabetIndex = 0
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (alphabetIndex < alphabet.length) {
        row.push(alphabet[alphabetIndex])
        alphabetIndex++
      } else {
        row.push('') // Empty cell if we run out of letters
      }
    }
    content.push(row)
  }
  
  return content
}

function generateNumberSequenceTable(rows: number, cols: number, title: string, message: string, startNum: number = 1, endNum?: number): string[][] {
  const content: string[][] = []
  const totalCells = rows * cols
  
  // Default to 1-9 if no end number specified and message mentions 1-9
  if (!endNum && message.includes('9')) {
    endNum = 9
  } else if (!endNum) {
    endNum = startNum + totalCells - 1
  }
  
  // Generate the number sequence
  const numbers: string[] = []
  for (let i = startNum; i <= endNum && numbers.length < totalCells; i++) {
    numbers.push(i.toString())
  }
  
  // Fill table with numbers
  let numberIndex = 0
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (numberIndex < numbers.length) {
        row.push(numbers[numberIndex])
        numberIndex++
      } else {
        row.push('') // Empty cell if we run out of numbers
      }
    }
    content.push(row)
  }
  
  return content
}

function generateGenericTable(rows: number, cols: number, title: string): string[][] {
  const content: string[][] = []
  
  for (let i = 0; i < rows; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      if (i === 0) {
        row.push(`Column ${j + 1}`)
      } else {
        row.push(`Row ${i}, Col ${j + 1}`)
      }
    }
    content.push(row)
  }
  
  return content
}
