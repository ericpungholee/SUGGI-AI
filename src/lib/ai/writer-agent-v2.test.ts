/**
 * Test file for Writer Agent V2 system
 * This file demonstrates the integration and can be used for testing
 */

import { createWriterAgentV2, RouterOut, Instruction, PreviewOps } from './writer-agent-v2'

/**
 * Test the Writer Agent V2 system
 */
export async function testWriterAgentV2() {
  console.log('🧪 Testing Writer Agent V2 system...')
  
  try {
    // Create Writer Agent instance
    const writerAgent = createWriterAgentV2('test-user-id', 'test-doc-id')
    
    // Test 1: Route a simple rewrite request
    console.log('\n1. Testing Router...')
    const routerOut = await writerAgent.route(
      'Make this text more friendly',
      'The current implementation is suboptimal.',
      'test-doc.md',
      ['documentation', 'improvements']
    )
    
    console.log('Router output:', JSON.stringify(routerOut, null, 2))
    
    // Test 2: Plan instruction
    console.log('\n2. Testing Planner...')
    const instruction = await writerAgent.plan(
      routerOut,
      'Make this text more friendly',
      'The current implementation is suboptimal.',
      '# Test Document\n\nSome content here.',
      [], // No RAG chunks for this test
      [] // No web results for this test
    )
    
    console.log('Instruction output:', JSON.stringify(instruction, null, 2))
    
    // Test 3: Execute and generate preview ops
    console.log('\n3. Testing Executor...')
    const previewOps = await writerAgent.execute(instruction)
    
    console.log('Preview ops output:', JSON.stringify(previewOps, null, 2))
    
    // Test 4: Generate approval message
    console.log('\n4. Testing Approval Message...')
    const approvalMessage = writerAgent.generateApprovalMessage(previewOps)
    console.log('Approval message:', approvalMessage)
    
    console.log('\n✅ All tests completed successfully!')
    
    return {
      success: true,
      routerOut,
      instruction,
      previewOps,
      approvalMessage
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Test different task types
 */
export async function testTaskTypes() {
  console.log('🧪 Testing different task types...')
  
  const writerAgent = createWriterAgentV2('test-user-id', 'test-doc-id')
  
  const testCases = [
    {
      name: 'Rewrite task',
      userAsk: 'Rewrite this paragraph to be more concise',
      selectionText: 'This is a very long paragraph that could be made more concise and easier to read.'
    },
    {
      name: 'Summarize task',
      userAsk: 'Summarize the key points',
      selectionText: 'The document discusses several important concepts including data structures, algorithms, and implementation details.'
    },
    {
      name: 'Extend task',
      userAsk: 'Add more details about the benefits',
      selectionText: 'This approach has many benefits.'
    },
    {
      name: 'Outline task',
      userAsk: 'Create an outline for this content',
      selectionText: 'We need to discuss the introduction, methodology, results, and conclusion.'
    }
  ]
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing ${testCase.name}...`)
    
    try {
      const routerOut = await writerAgent.route(
        testCase.userAsk,
        testCase.selectionText
      )
      
      console.log(`  Task: ${routerOut.task}`)
      console.log(`  Confidence: ${routerOut.confidence}`)
      console.log(`  Web context needed: ${routerOut.needs.web_context}`)
      
    } catch (error) {
      console.error(`  ❌ Failed: ${error}`)
    }
  }
  
  console.log('\n✅ Task type tests completed!')
}

// Export for use in other test files
export { createWriterAgentV2 }
