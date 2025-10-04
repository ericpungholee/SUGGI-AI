import { getOpenAI } from '../core/openai-client';
import { getWebSearchModel } from '../core/models';

// Re-export types from core
export type { Citation, WebSearchOptions, WebSearchResult } from '../core/types';

// Simplified web search - let GPT-5 handle query optimization internally

/**
 * Enhanced web search using GPT-5's web_search tool
 */
export async function webSearch({
  prompt,
  model = getWebSearchModel(),
  timeoutMs = 30_000, // Reduced from 45s to 30s
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

  try {
    const openai = getOpenAI();

    // Try chat completions API with web_search tool first (more reliable)
    let resp: any;
    try {
      resp = await openai.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          tools: [{ 
            type: "web_search"
          }],
          max_tokens: 4000,
          temperature: 0.1
        },
        { timeout: timeoutMs }
      );
      
      // Convert chat completion response to responses format
      resp = {
        output_text: resp.choices[0]?.message?.content || '',
        output: resp.choices[0]?.message?.tool_calls || [],
        status: 'completed',
        model: resp.model
      };
    } catch (chatError) {
      console.log('🔄 Chat completions failed, trying responses API...', chatError);
      
      // Fallback to responses API
      resp = await openai.responses.create(
        {
          model,
          input: prompt,
          tools: [{ 
            type: "web_search"
          }],
          max_output_tokens: 4000
        },
        { timeout: timeoutMs }
      );
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
    
    // Handle specific timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('Web search timed out. Please try again with a simpler query.');
    }
    
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Robust web search with retry logic
 */
export async function robustWebSearch(args: WebSearchOptions): Promise<WebSearchResult> {
  const maxAttempts = 2; // Reduced from 3 to 2
  const baseDelay = 1000; // Increased base delay
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔄 Web Search Attempt ${attempt + 1}/${maxAttempts}`);
      
      // Add exponential backoff with jitter
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
      
      const result = await webSearch(args);
      
      // Validate result quality - be more lenient with citations
      if (result.text && result.text.length > 50) {
        console.log(`✅ Web Search Successful on attempt ${attempt + 1}`);
        return result;
      } else {
        throw new Error(`Poor quality result: text=${result.text.length}`);
      }
      
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const isTimeout = /timeout|AbortError|504/i.test(msg);
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
      
      // Don't retry on last attempt
      if (attempt === maxAttempts - 1) {
        throw new Error(`Web search failed after ${maxAttempts} attempts: ${msg}`);
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
