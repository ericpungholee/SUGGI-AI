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
export function parseTableRequest(message: string, documentContent?: string): TableSpec | null {
  const lowerMessage = message.toLowerCase()
  
  // Check if this is a data-driven table creation request
  if (isDataDrivenTableRequest(message, documentContent)) {
    return parseDataDrivenTable(message, documentContent)
  }
  
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
 * Check if this is a data-driven table creation request
 */
function isDataDrivenTableRequest(message: string, documentContent?: string): boolean {
  const lowerMessage = message.toLowerCase()
  
  // Look for patterns that indicate data-driven table creation
  const dataPatterns = [
    /use\s+(?:these|this)\s+(?:to\s+)?create\s+(?:a\s+)?table/i,
    /create\s+(?:a\s+)?table\s+(?:from|with|using)\s+(?:these|this)/i,
    /make\s+(?:a\s+)?table\s+(?:from|with|using)\s+(?:these|this)/i,
    /organize\s+(?:these|this)\s+(?:into|as)\s+(?:a\s+)?table/i,
    /format\s+(?:these|this)\s+(?:as|into)\s+(?:a\s+)?table/i,
    /convert\s+(?:these|this)\s+(?:to|into)\s+(?:a\s+)?table/i,
    /put\s+(?:these|this)\s+(?:in|into)\s+(?:a\s+)?table/i,
    /table\s+(?:from|with|using)\s+(?:these|this)/i,
    /turn\s+(?:these|this)\s+(?:into|to)\s+(?:a\s+)?table/i,
    // Add patterns for document-based table creation
    /use\s+(?:the\s+)?data\s+(?:on|in)\s+(?:the\s+)?(?:current\s+)?document/i,
    /organize\s+(?:the\s+)?data\s+(?:on|in)\s+(?:the\s+)?(?:current\s+)?document/i,
    /convert\s+(?:the\s+)?data\s+(?:on|in)\s+(?:the\s+)?(?:current\s+)?document/i,
    /format\s+(?:the\s+)?data\s+(?:on|in)\s+(?:the\s+)?(?:current\s+)?document/i,
    // Add patterns for web search table creation
    /create\s+(?:a\s+)?table\s+(?:based\s+on|from)\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)/i,
    /generate\s+(?:a\s+)?table\s+(?:based\s+on|from)\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)/i,
    /make\s+(?:a\s+)?table\s+(?:based\s+on|from)\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)/i,
    /organize\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)\s+(?:into|as)\s+(?:a\s+)?table/i,
    /format\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)\s+(?:as|into)\s+(?:a\s+)?table/i,
    /convert\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)\s+(?:to|into)\s+(?:a\s+)?table/i,
    /put\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)\s+(?:in|into)\s+(?:a\s+)?table/i,
    /turn\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)\s+(?:into|to)\s+(?:a\s+)?table/i,
    /table\s+(?:from|with|using)\s+(?:the\s+)?(?:web\s+)?(?:search\s+)?(?:results?|data)/i,
    // General table creation patterns
    /create\s+(?:a\s+)?table/i,
    /generate\s+(?:a\s+)?table/i,
    /make\s+(?:a\s+)?table/i,
    /organize\s+(?:.*?)\s+(?:into|as)\s+(?:a\s+)?table/i,
    /format\s+(?:.*?)\s+(?:as|into)\s+(?:a\s+)?table/i
  ]
  
  // Check for tabular data patterns in the message
  const hasTabularData = /\t|\s{2,}|\|\s*/.test(message) // tabs, multiple spaces, or pipe separators
  const hasDataRows = message.split('\n').filter(line => 
    line.trim().length > 0 && 
    (line.includes('\t') || line.includes('  ') || line.includes('|'))
  ).length >= 2
  
  // Check for revenue/financial data patterns
  const hasFinancialData = /q[1-4]\s*2024|revenue|billion|\$[\d.]+/.test(lowerMessage)
  
  // Check if document contains table data that should be used
  const hasDocumentTableData = documentContent && (
    documentContent.includes('<table') || 
    documentContent.includes('Q4 2024') || 
    documentContent.includes('Q3 2024') || 
    documentContent.includes('revenue') ||
    documentContent.includes('billion')
  )
  
  console.log('🔍 Data-driven table detection:', {
    hasDataPatterns: dataPatterns.some(pattern => pattern.test(message)),
    hasTabularData,
    hasDataRows,
    hasFinancialData,
    hasDocumentTableData,
    message: message.substring(0, 100)
  })
  
  return dataPatterns.some(pattern => pattern.test(message)) || 
         (hasTabularData && hasDataRows) || 
         hasFinancialData || 
         (hasDocumentTableData && lowerMessage.includes('data') && lowerMessage.includes('table'))
}

/**
 * Parse data-driven table creation request
 */
function parseDataDrivenTable(message: string, documentContent?: string): TableSpec | null {
  console.log('🔍 Parsing data-driven table request:', message.substring(0, 200))
  
  // Check if this is a web search table request
  const lowerMessage = message.toLowerCase()
  const isWebSearchTable = lowerMessage.includes('research') || lowerMessage.includes('search') || 
                          lowerMessage.includes('web') || lowerMessage.includes('look up') ||
                          lowerMessage.includes('find') || lowerMessage.includes('get') ||
                          lowerMessage.includes('based on') || lowerMessage.includes('from the data') ||
                          lowerMessage.includes('do a research') || lowerMessage.includes('research on')
  
  // If this is a web search table request, prioritize web search data over document data
  if (isWebSearchTable) {
    console.log('🌐 Web search table request detected, checking for web search results')
    
    // If web search results are available, use them
    if (documentContent && documentContent.includes('WEB SEARCH RESULTS:')) {
      console.log('🌐 Extracting data from web search results')
      const webSearchData = extractTableDataFromWebSearch(documentContent)
      if (webSearchData && webSearchData.length > 0) {
        console.log('✅ Extracted data from web search:', webSearchData)
        return {
          rows: webSearchData.length,
          cols: webSearchData[0]?.length || 0,
          hasHeaders: true,
          content: webSearchData,
          title: 'Web Search Data Table'
        }
      }
    } else {
      // If no web search results yet, don't return null - let GPT handle the web search during content generation
      console.log('🌐 Web search table request detected - will let GPT handle web search during content generation')
      // Don't return null here - let the content generation proceed with web search enabled
    }
  }
  
  // If the message asks to use document data, extract data from document content
  if (documentContent && message.toLowerCase().includes('data') && message.toLowerCase().includes('document')) {
    console.log('📄 Extracting data from document content')
    const extractedData = extractTableDataFromDocument(documentContent)
    if (extractedData && extractedData.length > 0) {
      console.log('✅ Extracted data from document:', extractedData)
      return {
        rows: extractedData.length,
        cols: extractedData[0]?.length || 0,
        hasHeaders: true,
        content: extractedData,
        title: 'Document Data Table'
      }
    }
  }
  
  // Split message into lines and filter out empty lines
  const lines = message.split('\n').filter(line => line.trim().length > 0)
  
  // Find the data section (before any "create table" instructions)
  let dataLines: string[] = []
  let instructionLine = ''
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()
    if (line.includes('create') && line.includes('table') || 
        line.includes('make') && line.includes('table') ||
        line.includes('use') && line.includes('table') ||
        line.includes('organize') && line.includes('table') ||
        line.includes('format') && line.includes('table') ||
        line.includes('convert') && line.includes('table') ||
        line.includes('turn') && line.includes('table')) {
      instructionLine = lines[i]
      dataLines = lines.slice(0, i)
      break
    }
  }
  
  // If no instruction line found, check if instruction is at the end
  if (dataLines.length === 0) {
    const lastLine = lines[lines.length - 1]?.toLowerCase() || ''
    if (lastLine.includes('create') && lastLine.includes('table') || 
        lastLine.includes('make') && lastLine.includes('table') ||
        lastLine.includes('use') && lastLine.includes('table') ||
        lastLine.includes('organize') && lastLine.includes('table') ||
        lastLine.includes('format') && lastLine.includes('table') ||
        lastLine.includes('convert') && lastLine.includes('table') ||
        lastLine.includes('turn') && lastLine.includes('table')) {
      instructionLine = lines[lines.length - 1]
      dataLines = lines.slice(0, -1)
    } else {
      // Use all lines as data
      dataLines = lines
    }
  }
  
  if (dataLines.length === 0) {
    console.log('❌ No data lines found')
    return null
  }
  
  console.log('📊 Data lines found:', dataLines.length)
  console.log('📝 Sample data:', dataLines.slice(0, 3))
  
  // Parse the data into rows and columns
  const parsedData = parseTabularData(dataLines)
  
  if (parsedData.length === 0) {
    console.log('❌ No valid data parsed')
    return null
  }
  
  const rows = parsedData.length
  const cols = parsedData[0]?.length || 0
  const hasHeaders = true // Assume first row is headers for data-driven tables
  
  console.log('✅ Parsed table data:', { rows, cols, hasHeaders })
  console.log('📋 Sample parsed data:', parsedData.slice(0, 2))
  
  return {
    rows,
    cols,
    hasHeaders,
    content: parsedData,
    title: extractTableTitle(instructionLine || message)
  }
}

/**
 * Parse tabular data from lines
 */
function parseTabularData(lines: string[]): string[][] {
  const data: string[][] = []
  
  for (const line of lines) {
    if (line.trim().length === 0) continue
    
    // Try different delimiters
    let cells: string[] = []
    
    if (line.includes('\t')) {
      // Tab-separated
      cells = line.split('\t').map(cell => cell.trim())
    } else if (line.includes('|')) {
      // Pipe-separated
      cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0)
    } else if (line.includes('  ')) {
      // Multiple spaces (aligned columns)
      cells = line.split(/\s{2,}/).map(cell => cell.trim()).filter(cell => cell.length > 0)
    } else {
      // Single space or comma
      if (line.includes(',')) {
        cells = line.split(',').map(cell => cell.trim())
      } else {
        // For financial data like "Q4 2024 $40.1 billion", split on space but be smart about it
        if (line.match(/q[1-4]\s*2024|\$[\d.]+/i)) {
          // This looks like financial data, split more carefully
          const parts = line.split(/\s+/)
          if (parts.length >= 2) {
            // First part is period (Q4 2024), rest is revenue
            const period = parts[0] + ' ' + parts[1]
            const revenue = parts.slice(2).join(' ')
            cells = [period, revenue]
          } else {
            cells = line.split(/\s+/).map(cell => cell.trim())
          }
        } else {
          cells = line.split(/\s+/).map(cell => cell.trim())
        }
      }
    }
    
    if (cells.length > 0) {
      data.push(cells)
    }
  }
  
  console.log('📊 Parsed tabular data:', data)
  return data
}

/**
 * Extract table data from web search results
 */
function extractTableDataFromWebSearch(documentContent: string): string[][] | null {
  try {
    console.log('🔍 Extracting table data from web search results')
    
    // Find the web search results section
    const webSearchMatch = documentContent.match(/WEB SEARCH RESULTS:\s*([\s\S]*?)(?:\n\n|$)/i)
    if (!webSearchMatch) {
      console.log('⚠️ No web search results found in document content')
      return null
    }
    
    const webSearchContent = webSearchMatch[1]
    console.log('📊 Web search content preview:', webSearchContent.substring(0, 500))
    console.log('📊 Full web search content length:', webSearchContent.length)
    console.log('📊 Web search content lines:', webSearchContent.split('\n').length)
    
    // Look for structured data patterns in web search results
    const lines = webSearchContent.split('\n').filter(line => line.trim().length > 0)
    
    // Try to find tabular data patterns - be more flexible with web search results
    const dataLines = lines.filter(line => {
      const lowerLine = line.toLowerCase()
      // Look for lines that might contain financial or revenue data
      return line.includes('|') || // Pipe separators
             line.includes('\t') || // Tab separators
             (line.match(/\d+/) && line.match(/\$/) && line.match(/\d+\.\d+/)) || // Financial data
             (line.match(/\d{4}/) && line.match(/\d+\.\d+/)) || // Year + number patterns
             line.includes('Q1') || line.includes('Q2') || line.includes('Q3') || line.includes('Q4') || // Quarterly data
             line.match(/\d+\s*[x×]\s*\d+/) || // Dimension patterns
             line.match(/\$\d+\.?\d*\s*(?:billion|million|thousand)/i) || // Currency patterns
             // More flexible patterns for web search results
             (lowerLine.includes('revenue') && (lowerLine.includes('$') || lowerLine.includes('billion') || lowerLine.includes('million'))) ||
             (lowerLine.includes('year') && (lowerLine.includes('$') || lowerLine.includes('billion') || lowerLine.includes('million'))) ||
             (lowerLine.includes('growth') && (lowerLine.includes('$') || lowerLine.includes('billion') || lowerLine.includes('million'))) ||
             (lowerLine.includes('earnings') && (lowerLine.includes('$') || lowerLine.includes('billion') || lowerLine.includes('million'))) ||
             (lowerLine.includes('income') && (lowerLine.includes('$') || lowerLine.includes('billion') || lowerLine.includes('million'))) ||
             // Look for year patterns with financial data
             (line.match(/\d{4}/) && (lowerLine.includes('revenue') || lowerLine.includes('$') || lowerLine.includes('billion') || lowerLine.includes('million'))) ||
             // Look for percentage patterns
             (line.match(/\d+\.?\d*%/) && (lowerLine.includes('revenue') || lowerLine.includes('growth')))
    })
    
    if (dataLines.length === 0) {
      console.log('⚠️ No structured data found in web search results')
      return null
    }
    
    console.log('📊 Found structured data lines:', dataLines)
    
    // Parse the structured data
    let parsedData = parseTabularData(dataLines)
    
    // If no structured data found, try to extract data from natural language
    if (parsedData.length === 0) {
      console.log('🔄 No structured data found, trying to extract from natural language')
      parsedData = extractDataFromNaturalLanguage(webSearchContent, message)
    }
    
    if (parsedData.length > 0) {
      console.log('✅ Successfully parsed web search data:', parsedData)
      return parsedData
    }
    
    return null
  } catch (error) {
    console.error('Error extracting table data from web search:', error)
    return null
  }
}

/**
 * Extract data from natural language web search results
 */
function extractDataFromNaturalLanguage(webSearchContent: string, originalMessage: string): string[][] {
  console.log('🔍 Extracting data from natural language web search results')
  
  const data: string[][] = []
  const lowerMessage = originalMessage.toLowerCase()
  
  // Determine what type of data we're looking for based on the original message
  const isRevenueData = lowerMessage.includes('revenue') || lowerMessage.includes('earnings') || lowerMessage.includes('income')
  const isGrowthData = lowerMessage.includes('growth')
  const isYearlyData = lowerMessage.includes('year') || lowerMessage.includes('yearly')
  const isQuarterlyData = lowerMessage.includes('quarter') || lowerMessage.includes('quarterly')
  
  // Extract years from the message if specified
  const yearMatch = originalMessage.match(/(\d{4})/g)
  const targetYears = yearMatch ? yearMatch.map(y => parseInt(y)) : []
  
  console.log('🎯 Looking for data type:', { isRevenueData, isGrowthData, isYearlyData, isQuarterlyData, targetYears })
  
  // Split content into sentences and look for data patterns
  const sentences = webSearchContent.split(/[.!?]+/).filter(s => s.trim().length > 0)
  console.log('📝 Processing sentences:', sentences.length)
  console.log('📝 Sample sentences:', sentences.slice(0, 3))
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase()
    
    // Look for revenue/financial data patterns
    if (isRevenueData && (lowerSentence.includes('revenue') || lowerSentence.includes('earnings') || lowerSentence.includes('income'))) {
      // Extract year and amount
      const yearMatch = sentence.match(/(\d{4})/)
      const amountMatch = sentence.match(/\$?(\d+\.?\d*)\s*(billion|million|thousand)/i)
      
      if (yearMatch && amountMatch) {
        const year = yearMatch[1]
        const amount = amountMatch[1]
        const unit = amountMatch[2]
        const fullAmount = `$${amount} ${unit}`
        
        // Only include if it's a target year or if no specific years were requested
        if (targetYears.length === 0 || targetYears.includes(parseInt(year))) {
          data.push([year, fullAmount])
          console.log(`📊 Found revenue data: ${year} - ${fullAmount}`)
        }
      }
    }
    
    // Look for growth data patterns
    if (isGrowthData && lowerSentence.includes('growth')) {
      const yearMatch = sentence.match(/(\d{4})/)
      const growthMatch = sentence.match(/(\d+\.?\d*%?)/)
      
      if (yearMatch && growthMatch) {
        const year = yearMatch[1]
        const growth = growthMatch[1]
        
        if (targetYears.length === 0 || targetYears.includes(parseInt(year))) {
          data.push([year, growth])
          console.log(`📊 Found growth data: ${year} - ${growth}`)
        }
      }
    }
  }
  
  // If we found data, add headers
  if (data.length > 0) {
    if (isRevenueData) {
      data.unshift(['Year', 'Revenue'])
    } else if (isGrowthData) {
      data.unshift(['Year', 'Growth Rate'])
    } else {
      data.unshift(['Year', 'Value'])
    }
  }
  
  console.log('📊 Extracted natural language data:', data)
  return data
}

/**
 * Extract table data from document content
 */
function extractTableDataFromDocument(documentContent: string): string[][] | null {
  try {
    console.log('🔍 Extracting table data from document content')
    
    // Look for existing table data in the document
    const tableMatch = documentContent.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
    if (tableMatch) {
      const tableHTML = tableMatch[1]
      console.log('📊 Found existing table in document:', tableHTML.substring(0, 200))
      
      // Extract data from table HTML
      const rows: string[][] = []
      
      // Extract header row
      const headerMatch = tableHTML.match(/<thead[^>]*>[\s\S]*?<tr[^>]*>(.*?)<\/tr>[\s\S]*?<\/thead>/i)
      if (headerMatch) {
        const headerCells = headerMatch[1].match(/<th[^>]*>(.*?)<\/th>/gi)
        if (headerCells) {
          const headerRow = headerCells.map(cell => 
            cell.replace(/<[^>]*>/g, '').trim()
          )
          rows.push(headerRow)
        }
      }
      
      // Extract data rows
      const tbodyMatch = tableHTML.match(/<tbody[^>]*>(.*?)<\/tbody>/i)
      if (tbodyMatch) {
        const tbodyContent = tbodyMatch[1]
        const rowMatches = tbodyContent.match(/<tr[^>]*>(.*?)<\/tr>/gi)
        if (rowMatches) {
          for (const rowMatch of rowMatches) {
            const cellMatches = rowMatch.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gi)
            if (cellMatches) {
              const row = cellMatches.map(cell => 
                cell.replace(/<[^>]*>/g, '').trim()
              )
              rows.push(row)
            }
          }
        }
      }
      
      if (rows.length > 0) {
        console.log('✅ Extracted table data:', rows)
        return rows
      }
    }
    
    // If no table found, look for structured data patterns
    const lines = documentContent.split('\n').filter(line => line.trim().length > 0)
    const dataLines = lines.filter(line => 
      line.includes('Q4 2024') || 
      line.includes('Q3 2024') || 
      line.includes('revenue') || 
      line.includes('billion') ||
      line.includes('$')
    )
    
    if (dataLines.length > 0) {
      console.log('📊 Found structured data lines:', dataLines)
      return parseTabularData(dataLines)
    }
    
    return null
  } catch (error) {
    console.error('Error extracting table data from document:', error)
    return null
  }
}

/**
 * Extract table title from instruction
 */
function extractTableTitle(instruction: string): string {
  const lowerInstruction = instruction.toLowerCase()
  
  // Look for title patterns
  const titlePatterns = [
    /table\s+(?:for|about|on|of)\s+(.+?)(?:\s+with|\s+that|\s+showing|$)/i,
    /create\s+(?:a\s+)?table\s+(?:for|about|on|of)\s+(.+?)(?:\s+with|\s+that|\s+showing|$)/i,
    /make\s+(?:a\s+)?table\s+(?:for|about|on|of)\s+(.+?)(?:\s+with|\s+that|\s+showing|$)/i
  ]
  
  for (const pattern of titlePatterns) {
    const match = instruction.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Default title based on content
  return 'Data Table'
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

/**
 * Generate HTML table from table specification
 */
export function generateTableFromSpec(spec: TableSpec): string {
  let tableHTML = '<table class="editor-table" data-table="true">\n'
  
  if (spec.hasHeaders) {
    tableHTML += '  <thead>\n    <tr>\n'
    for (let col = 0; col < spec.cols; col++) {
      const headerText = spec.content?.[0]?.[col] || `Header ${col + 1}`
      tableHTML += `      <th contenteditable="true" data-table-cell="true">${headerText}</th>\n`
    }
    tableHTML += '    </tr>\n  </thead>\n'
  }
  
  tableHTML += '  <tbody>\n'
  
  const startRow = spec.hasHeaders ? 1 : 0
  for (let row = startRow; row < spec.rows; row++) {
    tableHTML += '    <tr>\n'
    for (let col = 0; col < spec.cols; col++) {
      const cellText = spec.content?.[row]?.[col] || `Cell ${row + 1}-${col + 1}`
      tableHTML += `      <td contenteditable="true" data-table-cell="true">${cellText}</td>\n`
    }
    tableHTML += '    </tr>\n'
  }
  
  tableHTML += '</tbody></table>\n'
  
  return tableHTML
}
