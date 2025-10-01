import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Test endpoint: Starting test')
    
    // Test basic import
    console.log('🔍 Test endpoint: Testing imports')
    const { createWriterAgentV2 } = await import('@/lib/ai/writer-agent-v2')
    console.log('✅ Test endpoint: Imports successful')
    
    // Test basic instantiation
    console.log('🔍 Test endpoint: Testing Writer Agent creation')
    const writerAgent = createWriterAgentV2('test-user', 'test-doc')
    console.log('✅ Test endpoint: Writer Agent created successfully')
    
    // Test basic routing
    console.log('🔍 Test endpoint: Testing routing')
    const routerOut = await writerAgent.route('test message', '', '')
    console.log('✅ Test endpoint: Routing successful', routerOut)
    
    return NextResponse.json({
      success: true,
      message: 'All tests passed',
      routerOut
    })
  } catch (error) {
    console.error('❌ Test endpoint error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
