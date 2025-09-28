export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  publishedDate?: string
  source?: string
}

export interface WebSearchOptions {
  limit?: number
  language?: string
  region?: string
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
}

/**
 * Search the web for information
 * Uses Tavily API for real search results, falls back to DuckDuckGo
 */
export async function searchWeb(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  try {
    const {
      limit = 10,
      language = 'en',
      region = 'us',
      timeRange = 'all'
    } = options

    // Try Tavily API first (best for AI applications)
    try {
      const tavilyResults = await performTavilySearch(query, limit)
      if (tavilyResults && tavilyResults.length > 0) {
        console.log(`Tavily search found ${tavilyResults.length} results for: ${query}`)
        return tavilyResults
      }
    } catch (tavilyError) {
      console.warn('Tavily search failed, trying DuckDuckGo:', tavilyError.message)
    }

    // Try DuckDuckGo as fallback
    try {
      const duckDuckGoResults = await performDuckDuckGoSearch(query, limit)
      if (duckDuckGoResults && duckDuckGoResults.length > 0) {
        console.log(`DuckDuckGo search found ${duckDuckGoResults.length} results for: ${query}`)
        
        // Check if results are meaningful (not just search page redirects)
        const hasMeaningfulContent = duckDuckGoResults.some(result => 
          result.snippet && 
          result.snippet.length > 50 && 
          !result.snippet.includes('Search results for') &&
          !result.snippet.includes('Click to view more information') &&
          !result.snippet.includes('No abstract available')
        )
        
        if (hasMeaningfulContent) {
          console.log('DuckDuckGo results are meaningful, using them')
          return duckDuckGoResults
        } else {
          console.log('DuckDuckGo results are not meaningful, returning empty results')
        }
      }
    } catch (duckDuckGoError) {
      console.warn('DuckDuckGo search failed, falling back to mock:', duckDuckGoError.message)
    }

    // If both APIs fail, return empty results instead of mock data
    console.log('Both Tavily and DuckDuckGo search failed, returning empty results')
    return []
  } catch (error) {
    console.error('Error searching web:', error)
    throw new Error('Failed to search web')
  }
}

/**
 * Perform web search using Tavily API (best for AI applications)
 */
async function performTavilySearch(query: string, limit: number): Promise<WebSearchResult[]> {
  try {
    const tavilyApiKey = process.env.TAVILY_API_KEY
    
    if (!tavilyApiKey) {
      throw new Error('Tavily API key not configured')
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
        max_results: limit,
        include_domains: [],
        exclude_domains: []
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data = await response.json()
    const results: WebSearchResult[] = []

    // Process search results
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result: any) => {
        results.push({
          title: result.title || 'No title',
          url: result.url || '',
          snippet: result.content || result.snippet || '',
          publishedDate: result.published_date || new Date().toISOString(),
          source: 'Tavily'
        })
      })
    }

    // Add answer if available
    if (data.answer && results.length === 0) {
      results.push({
        title: `${query} - Answer`,
        url: `https://tavily.com/search?q=${encodeURIComponent(query)}`,
        snippet: data.answer,
        publishedDate: new Date().toISOString(),
        source: 'Tavily'
      })
    }

    return results.slice(0, limit)
  } catch (error) {
    console.error('Tavily search failed:', error)
    throw error
  }
}

/**
 * Perform web search using DuckDuckGo Instant Answer API
 */
async function performDuckDuckGoSearch(query: string, limit: number): Promise<WebSearchResult[]> {
  try {
    // Use DuckDuckGo Instant Answer API (free, no API key required)
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const results: WebSearchResult[] = []

    // Process Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: data.Abstract,
        publishedDate: new Date().toISOString(),
        source: 'DuckDuckGo'
      })
    }

    // Process Related Topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, limit - 1).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text,
            publishedDate: new Date().toISOString(),
            source: 'DuckDuckGo'
          })
        }
      })
    }

    // If we don't have enough results, add a general search result
    if (results.length < 2) {
      results.push({
        title: `${query} - Search Results`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Search results for "${query}". Click to view more information on DuckDuckGo.`,
        publishedDate: new Date().toISOString(),
        source: 'DuckDuckGo'
      })
    }

    return results.slice(0, limit)
  } catch (error) {
    console.error('DuckDuckGo search failed:', error)
    throw error
  }
}

/**
 * Search for recent news articles
 */
export async function searchNews(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  try {
    const results = await searchWeb(query, {
      ...options,
      timeRange: 'week'
    })

    // Filter and format for news
    return results.map(result => ({
      ...result,
      source: result.source || 'News'
    }))
  } catch (error) {
    console.error('Error searching news:', error)
    throw new Error('Failed to search news')
  }
}

/**
 * Search for academic papers and research
 */
export async function searchAcademic(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  try {
    // This would integrate with academic search APIs like:
    // - Google Scholar
    // - Semantic Scholar
    // - arXiv
    // - PubMed
    
    const results = await searchWeb(query, options)
    
    return results.map(result => ({
      ...result,
      source: 'Academic Search'
    }))
  } catch (error) {
    console.error('Error searching academic sources:', error)
    throw new Error('Failed to search academic sources')
  }
}

/**
 * Format search results for AI context
 */
export function formatSearchResultsForAI(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant web search results found.'
  }

  const formatted = results
    .map((result, index) => {
      return `[${index + 1}] ${result.title}
URL: ${result.url}
${result.snippet}
${result.publishedDate ? `Published: ${new Date(result.publishedDate).toLocaleDateString()}` : ''}
---`
    })
    .join('\n\n')

  return `Web Search Results:\n\n${formatted}`
}

/**
 * Extract key information from search results
 */
export function extractKeyInformation(results: WebSearchResult[]): {
  topics: string[]
  sources: string[]
  dates: string[]
} {
  const topics = new Set<string>()
  const sources = new Set<string>()
  const dates = new Set<string>()

  results.forEach(result => {
    // Extract topics from titles and snippets
    const text = `${result.title} ${result.snippet}`.toLowerCase()
    const words = text.split(/\s+/).filter(word => word.length > 3)
    words.forEach(word => {
      if (word.match(/^[a-z]+$/)) {
        topics.add(word)
      }
    })

    // Extract sources
    if (result.source) {
      sources.add(result.source)
    }

    // Extract dates
    if (result.publishedDate) {
      dates.add(new Date(result.publishedDate).toLocaleDateString())
    }
  })

  return {
    topics: Array.from(topics).slice(0, 10),
    sources: Array.from(sources),
    dates: Array.from(dates)
  }
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string): {
  isValid: boolean
  error?: string
} {
  if (!query || query.trim().length === 0) {
    return {
      isValid: false,
      error: 'Search query cannot be empty'
    }
  }

  if (query.length < 3) {
    return {
      isValid: false,
      error: 'Search query must be at least 3 characters long'
    }
  }

  if (query.length > 500) {
    return {
      isValid: false,
      error: 'Search query is too long (max 500 characters)'
    }
  }

  // Check for potentially harmful queries
  const harmfulPatterns = [
    /malware/i,
    /virus/i,
    /hack/i,
    /exploit/i
  ]

  for (const pattern of harmfulPatterns) {
    if (pattern.test(query)) {
      return {
        isValid: false,
        error: 'Search query contains potentially harmful content'
      }
    }
  }

  return { isValid: true }
}
