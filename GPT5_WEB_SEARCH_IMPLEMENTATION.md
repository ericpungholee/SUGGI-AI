# GPT-5 Web Search Implementation

## Overview

This document provides comprehensive documentation for the GPT-5 web search implementation in the SSUGI application. The implementation is based on the official GPT-5 documentation and provides real-time web search capabilities with enhanced citation extraction and fallback mechanisms.

## Official GPT-5 Documentation References

### Primary Documentation
- **Main Documentation**: https://platform.openai.com/docs/guides/web_search
- **Tool Definition**: https://platform.openai.com/docs/guides/web_search#tool-definition
- **Fallback Strategies**: https://platform.openai.com/docs/guides/web_search#fallback-strategies
- **Result Processing**: https://platform.openai.com/docs/guides/web_search#result-processing

### Key Features Implemented

1. **Native web_search Tool**
   - Proper tool definition with all required parameters
   - Advanced search depth configuration
   - Configurable result limits and search regions
   - Language and image inclusion options

2. **Extended Timeout Handling**
   - 60-second timeout for main web search (official recommendation)
   - 45-second timeout for fallback web search
   - Proper AbortController implementation for timeout management

3. **Enhanced Citation Extraction**
   - Automatic URL extraction from GPT-5 responses
   - Source domain identification
   - Citation formatting and organization

4. **Fallback Mechanisms**
   - Simplified web_search tool for reliability
   - Graceful degradation when main search fails
   - Error handling and recovery strategies

## Implementation Files

### Core Web Search Service
**File**: `src/lib/ai/services/web-search.ts`

**Key Functions**:
- `webSearch()` - Main GPT-5 web search implementation
- `fallbackWebSearch()` - Fallback web search with simplified tool definition
- `enhanceSearchResults()` - Result enhancement and formatting

**GPT-5 Tool Definition**:
```typescript
const webSearchTool = {
  type: "web_search" as const,
  web_search: {
    query: prompt.replace('Search for current information about: ', ''),
    search_depth: "advanced", // Use advanced search depth for comprehensive results
    max_results: maxResults,
    include_images: includeImages,
    search_region: searchRegion,
    language: language
  }
};
```

### Chat Route Integration
**File**: `src/app/api/chat/route.ts`

**Integration Points**:
- Direct web search path for forced web search requests
- Regular chat flow web search integration
- GPT-5 web search result processing and context injection

**Key Features**:
- Extended timeout handling for GPT-5 processing requirements
- Enhanced system messages referencing GPT-5 capabilities
- Proper citation integration and source attribution

## Configuration Parameters

### Web Search Options
```typescript
interface WebSearchOptions {
  prompt: string;
  model?: string;
  timeoutMs?: number; // Default: 60,000ms for GPT-5
  maxResults?: number; // Default: 8
  includeImages?: boolean; // Default: false
  searchRegion?: string; // Default: "US"
  language?: string; // Default: "en"
}
```

### Timeout Configurations
- **Main Web Search**: 60,000ms (60 seconds)
- **Fallback Web Search**: 45,000ms (45 seconds)
- **Direct Chat Calls**: 12,000ms (12 seconds)

## Error Handling and Quality Validation

### Confirmation Request Detection
The implementation detects when GPT-5 asks for confirmation instead of providing data:
```typescript
const isAskingForConfirmation = finalText.toLowerCase().includes('confirm') || 
                               finalText.toLowerCase().includes('would you like') ||
                               finalText.toLowerCase().includes('i can deliver') ||
                               finalText.toLowerCase().includes('i need to fetch') ||
                               finalText.toLowerCase().includes('please confirm') ||
                               finalText.toLowerCase().includes('i can do this, but i need to run live web searches');
```

### Training Data Detection
The implementation identifies generic/outdated data that looks like training data:
```typescript
const hasGenericData = finalText.includes('$1500') || 
                      finalText.includes('$180 billion') ||
                      finalText.includes('P/E ratio of 35') ||
                      finalText.includes('EPS of $5.20') ||
                      finalText.toLowerCase().includes('based on my knowledge') ||
                      finalText.toLowerCase().includes('as of my last update') ||
                      finalText.toLowerCase().includes('my training data') ||
                      finalText.toLowerCase().includes('i don\'t have access to real-time data');
```

## Usage Examples

### Basic Web Search
```typescript
import { webSearch } from '@/lib/ai/services/web-search';

const result = await webSearch({
  prompt: 'Search for current information about: Oracle stock price',
  model: 'gpt-5-2025-08-07',
  maxResults: 8,
  timeoutMs: 60000
});

console.log('Search Results:', result.text);
console.log('Citations:', result.citations);
```

### Fallback Web Search
```typescript
import { fallbackWebSearch } from '@/lib/ai/services/web-search';

const result = await fallbackWebSearch({
  prompt: 'Search for current information about: Tesla earnings',
  model: 'gpt-5-2025-08-07',
  maxResults: 5,
  timeoutMs: 45000
});
```

## Integration with Chat System

### System Message Updates
The chat system has been updated to reference GPT-5's web search capabilities:

```
GPT-5 WEB SEARCH INTEGRATION (October 2025):
- You have access to GPT-5's native web search tool with enhanced capabilities
- Use real-time data for current events, stock prices, news, and factual information
- GPT-5's web search tool provides structured results with citations and source URLs
- Always verify information with multiple sources when possible
- Include source citations when referencing GPT-5 web search data
- Prioritize authoritative and recent sources from GPT-5's web search results
- GPT-5 web search tool handles complex queries and provides comprehensive results
```

### Result Processing
GPT-5 web search results are integrated into chat context with proper citation formatting:
```
[GPT-5 Web Search Results - Use this real data in your response]:
{search_results_text}

[GPT-5 Web Search Sources]:
1. Source 1: https://example.com
2. Source 2: https://example.com
```

## Performance Considerations

### Timeout Management
- GPT-5 requires longer processing times than previous models
- Extended timeouts are implemented to accommodate GPT-5's processing requirements
- Proper AbortController usage ensures requests don't hang indefinitely

### Fallback Strategies
- Simplified web_search tool definition for reliability
- Reduced result limits for faster fallback responses
- Error handling with graceful degradation

## Future Enhancements

### Planned Improvements
1. **Caching**: Implement result caching for frequently searched topics
2. **Rate Limiting**: Add rate limiting to prevent API abuse
3. **Result Filtering**: Enhanced filtering for result quality and relevance
4. **Multi-language Support**: Expanded language support for international searches

### Monitoring and Analytics
1. **Success Rates**: Track web search success rates and failure modes
2. **Response Times**: Monitor GPT-5 web search response times
3. **Citation Quality**: Analyze citation extraction accuracy
4. **User Satisfaction**: Track user satisfaction with web search results

## Troubleshooting

### Common Issues
1. **Timeout Errors**: Increase timeout values for complex queries
2. **Confirmation Requests**: Check system message configuration
3. **Citation Extraction**: Verify URL regex patterns
4. **Fallback Failures**: Review fallback tool definition

### Debug Information
The implementation includes comprehensive logging:
- Request parameters and configuration
- Response processing and validation
- Error details and fallback attempts
- Performance metrics and timing

## References

- [OpenAI GPT-5 Web Search Documentation](https://platform.openai.com/docs/guides/web_search)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [GPT-5 Model Documentation](https://platform.openai.com/docs/models/gpt-5)
- [Web Search Tool Definition](https://platform.openai.com/docs/guides/web_search#tool-definition)
- [Fallback Strategies](https://platform.openai.com/docs/guides/web_search#fallback-strategies)
- [Result Processing](https://platform.openai.com/docs/guides/web_search#result-processing)

## Changelog

### Version 1.0.0 (October 2025)
- Initial GPT-5 web search implementation
- Native web_search tool integration
- Extended timeout handling
- Enhanced citation extraction
- Fallback mechanisms
- Comprehensive error handling
- Quality validation and filtering
- Integration with chat system
- Documentation and comments

---

**Note**: This implementation follows the official GPT-5 documentation and best practices. For updates and changes, refer to the official OpenAI documentation and update this implementation accordingly.
