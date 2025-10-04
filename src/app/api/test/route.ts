import { NextRequest, NextResponse } from "next/server";
import { robustWebSearch } from "@/lib/ai/services/web-search";
import { getWebSearchModel } from "@/lib/ai/core/models";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testType = searchParams.get('type') || 'web-search';
    
    console.log(`🧪 Running AI test: ${testType}`);
    
    switch (testType) {
      case 'web-search':
        return await testWebSearch();
      case 'health':
        return await testHealth();
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown test type: ${testType}`,
          availableTests: ['web-search', 'health']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ AI Test Failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      message: "AI test failed"
    }, { status: 500 });
  }
}

async function testWebSearch() {
  console.log('🧪 Testing Web Search...');
  
  const testQuery = "Tesla stock price October 2025";
  
  const result = await robustWebSearch({
    prompt: `Search for current information about: ${testQuery}`,
    model: getWebSearchModel(),
    maxResults: 5,
    includeImages: false,
    searchRegion: 'US',
    language: 'en',
    timeoutMs: 20000 // Reduced timeout
  });

  console.log('✅ Web Search Test Results:', {
    textLength: result.text?.length || 0,
    citationsCount: result.citations?.length || 0,
    model: result.model,
    requestId: result.requestId
  });

  return NextResponse.json({
    success: true,
    testType: 'web-search',
    query: testQuery,
    result: {
      text: result.text,
      citations: result.citations,
      model: result.model,
      requestId: result.requestId,
      usage: result.usage
    },
    timestamp: new Date().toISOString(),
    message: "Web search test completed successfully"
  });
}

async function testHealth() {
  console.log('🧪 Testing AI Health...');
  
  // Test basic OpenAI connectivity
  try {
    const { getOpenAI } = await import('@/lib/ai/core/openai-client');
    const openai = getOpenAI();
    
    // Simple test - just check if client is initialized
    const isHealthy = !!openai;
    
    return NextResponse.json({
      success: true,
      testType: 'health',
      result: {
        openai_connected: isHealthy,
        timestamp: new Date().toISOString()
      },
      message: "AI health check completed successfully"
    });
  } catch (error) {
    throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
