import { getOpenAI } from '../core/openai-client';
import { getWebSearchModel } from '../core/models';

// Re-export types from core
export type { Citation, WebSearchOptions, WebSearchResult } from '../core/types';

// Export fallback function for direct use
// Export will be added after function declaration

// Simplified web search - let GPT-5 handle query optimization internally

/**
 * Enhanced web search using GPT-5's web_search tool
 */
export async function webSearch({
  prompt,
  model = getWebSearchModel(),
  timeoutMs = 45_000, // Increased to 45s for better reliability
  maxResults = 8,
  includeImages = false,
  searchRegion = "US",
  language = "en"
}: WebSearchOptions): Promise<WebSearchResult> {
  console.log('🔍 Web Search Request:', {
    model,
    prompt: prompt.substring(0, 100) + '...',
    maxResults,
    includeImages,
    searchRegion,
    language
  });

  let resp: any;
  
  try {
    const openai = getOpenAI();

    // Create AbortController for proper timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Use responses API with proper timeout handling
      resp = await openai.responses.create(
        {
          model,
          input: prompt,
          tools: [{ 
            type: "web_search"
          }],
          max_output_tokens: 4000
        },
        { 
          signal: controller.signal,
          timeout: timeoutMs 
        }
      );

      clearTimeout(timeoutId);

      // Poll for completion if response is incomplete with proper timeout handling
      let attempts = 0
      const maxAttempts = 8 // Increased attempts for better reliability
      while (resp.status === 'incomplete' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Increased delay for stability
        
        try {
          // Create new controller for each poll request
          const pollController = new AbortController();
          const pollTimeoutId = setTimeout(() => pollController.abort(), 20000); // 20s timeout for polls
          
          resp = await openai.responses.retrieve(resp.id, {}, { 
            signal: pollController.signal,
            timeout: 20000 
          });
          
          clearTimeout(pollTimeoutId);
        } catch (pollError) {
          console.warn('Error polling for completion:', pollError)
          clearTimeout(pollTimeoutId);
          // Don't break immediately, try a few more times
          if (attempts >= maxAttempts - 1) {
            break
          }
        }
        attempts++
      }
      
      if (resp.status === 'incomplete') {
        throw new Error('Web search response incomplete, falling back')
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

    const text = resp.output_text ?? "";
    console.log('✅ Web Search Response:', {
      textLength: text.length,
      status: resp.status
    });

    // Enhanced citation extraction for October 2025
    const citations: Citation[] = [];
    const seenUrls = new Set<string>();

    for (const item of resp.output ?? []) {
      if (item.type !== "message") continue;
      
      for (const part of item.content ?? []) {
        const anns = (part as any).annotations ?? [];
        
        for (const ann of anns) {
          if (ann.type === "url_citation" && ann.url && !seenUrls.has(ann.url)) {
            seenUrls.add(ann.url);
            
            citations.push({
              title: ann.title || ann.domain || 'Source',
              url: ann.url,
              domain: ann.domain,
              snippet: ann.snippet,
              published_date: ann.published_date
            });
          }
        }
      }
    }

    // Fallback: Extract URLs from text if no citations found
    if (citations.length === 0) {
      const urlRegex = /(https?:\/\/[^\s)]+)/gi;
      const urls = Array.from(text.matchAll(urlRegex));
      
      urls.forEach((match, index) => {
        const url = match[1];
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          citations.push({
            title: `Source ${index + 1}`,
            url: url,
            domain: new URL(url).hostname
          });
        }
      });
    }

    // Additional processing for October 2025 features
    const enhancedText = enhanceSearchResults(text, citations);

    return { 
      text: enhancedText, 
      citations, 
      requestId: (resp as any)?._request_id ?? null,
      usage: (resp as any)?.usage ?? null,
      model: resp.model
    };

  } catch (error) {
    console.error('❌ Web Search Error:', error);
    
    // Check if this is a timeout or abort error
    const isTimeoutError = error instanceof Error && (
      error.message.includes('timeout') || 
      error.message.includes('Request timed out') || 
      error.message.includes('incomplete') ||
      error.message.includes('aborted') ||
      error.message.includes('Request was aborted') ||
      error.message.includes('AbortError') ||
      (error as any)?.name === 'AbortError'
    );
    
    if (isTimeoutError) {
      console.log('🔄 Main web search failed due to timeout/abort, trying fallback approach...');
      try {
        return await fallbackWebSearch({ prompt, model, timeoutMs: 30000, maxResults, includeImages, searchRegion, language });
      } catch (fallbackError) {
        console.error('❌ Fallback web search also failed:', fallbackError);
        throw new Error('Web search timed out. The search is taking longer than expected. Please try again with a simpler query or try again later.');
      }
    }
    
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fallback web search using a simpler approach
 */
export async function fallbackWebSearch(args: WebSearchOptions): Promise<WebSearchResult> {
  console.log('🔄 Using fallback web search approach');
  
  try {
    const openai = getOpenAI();
    
    // Create AbortController for fallback timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for fallback
    
    try {
      // Use a simpler approach with shorter timeout
      const resp = await openai.responses.create(
        {
          model: args.model || getWebSearchModel(),
          input: `Search for: ${args.prompt}`,
          tools: [{ type: "web_search" }],
          max_output_tokens: 2000 // Reduced token limit
        },
        { 
          signal: controller.signal,
          timeout: 15000 
        }
      );
      
      clearTimeout(timeoutId);

      const text = resp.output_text ?? "";
      
      // Simple citation extraction
      const citations: Citation[] = [];
      const urlRegex = /(https?:\/\/[^\s)]+)/gi;
      const urls = Array.from(text.matchAll(urlRegex));
      
      urls.forEach((match, index) => {
        const url = match[1];
        citations.push({
          title: `Source ${index + 1}`,
          url: url,
          domain: new URL(url).hostname
        });
      });

      return {
        text: text,
        citations,
        requestId: (resp as any)?._request_id ?? null,
        usage: (resp as any)?.usage ?? null,
        model: resp.model
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.error('❌ Fallback web search also failed:', error);
    throw new Error(`Fallback web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Robust web search with retry logic
 */
export async function robustWebSearch(args: WebSearchOptions): Promise<WebSearchResult> {
  const maxAttempts = 3; // Restored to 3 attempts
  const baseDelay = 1000; // Reduced base delay for faster retries
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔄 Web Search Attempt ${attempt + 1}/${maxAttempts}`);
      
      // Add exponential backoff with jitter
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
      
      // Reduce timeout for retries to fail faster
      const retryTimeout = Math.max(15000, args.timeoutMs - (attempt * 5000));
      const result = await webSearch({ ...args, timeoutMs: retryTimeout });
      
      // Validate result quality - be more lenient with citations
      if (result.text && result.text.length > 50) {
        console.log(`✅ Web Search Successful on attempt ${attempt + 1}`);
        return result;
      } else {
        throw new Error(`Poor quality result: text=${result.text.length}`);
      }
      
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const isTimeout = /timeout|AbortError|504|aborted/i.test(msg);
      const isRateLimit = /rate.?limit|429/i.test(msg);
      const isServerError = /5\d\d/i.test(msg);
      
      console.log(`❌ Web Search Attempt ${attempt + 1} failed:`, {
        error: msg,
        isTimeout,
        isRateLimit,
        isServerError,
        willRetry: attempt < maxAttempts - 1
      });
      
      // Don't retry on client errors (4xx except 429)
      if (!isTimeout && !isRateLimit && !isServerError) {
        throw e;
      }
      
      // On last attempt, try fallback approach
      if (attempt === maxAttempts - 1) {
        console.log('🔄 Main web search failed, trying fallback approach...');
        try {
          return await fallbackWebSearch({ ...args, timeoutMs: 10000 }); // Even shorter timeout for fallback
        } catch (fallbackError) {
          throw new Error(`Web search failed after ${maxAttempts} attempts and fallback: ${msg}`);
        }
      }
    }
  }
  
  // This should never be reached due to the throw above, but TypeScript needs it
  throw new Error("Unexpected error in robust web search");
}

function enhanceSearchResults(text: string, citations: Citation[]): string {
  // Add current date context for October 2025
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Enhance the text with better formatting and context
  let enhanced = text;
  
  // Add timestamp if not present
  if (!enhanced.includes('2025') && !enhanced.includes('current') && !enhanced.includes('latest')) {
    enhanced = `[Current as of ${currentDate}] ${enhanced}`;
  }
  
  // Add source count if citations are available
  if (citations.length > 0) {
    enhanced += `\n\n[Sources: ${citations.length} references found]`;
  }
  
  return enhanced;
}
