/**
 * Test Script for Hybrid Learned Router
 * Demonstrates the new routing system capabilities
 */

import { hybridLearnedRouter } from './hybrid-learned-router'
import { routerService } from './router-service'

interface TestCase {
  query: string
  expectedIntent: string
  context: any
  description: string
}

const testCases: TestCase[] = [
  {
    query: "What is machine learning?",
    expectedIntent: "ask",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "General knowledge question"
  },
  {
    query: "What's the latest news about Tesla stock?",
    expectedIntent: "web_search",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Current information query"
  },
  {
    query: "What does my research document say about climate change?",
    expectedIntent: "rag_query",
    context: { has_attached_docs: true, doc_ids: ["research_doc"], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Document-specific question"
  },
  {
    query: "Rewrite this paragraph to be more concise",
    expectedIntent: "edit_request",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: true, selection_length: 100, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Text editing request"
  },
  {
    query: "Write an essay about renewable energy",
    expectedIntent: "editor_write",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Content creation request"
  },
  {
    query: "Create a business proposal for our new product",
    expectedIntent: "editor_write",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Business document creation"
  },
  {
    query: "According to my notes, what are the key findings?",
    expectedIntent: "rag_query",
    context: { has_attached_docs: true, doc_ids: ["notes_doc"], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Document reference query"
  },
  {
    query: "Today's weather in New York",
    expectedIntent: "web_search",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Time-sensitive information"
  },
  {
    query: "Improve the grammar in this text",
    expectedIntent: "edit_request",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: true, selection_length: 50, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Grammar improvement request"
  },
  {
    query: "Generate a report on market trends",
    expectedIntent: "editor_write",
    context: { has_attached_docs: false, doc_ids: [], is_selection_present: false, selection_length: 0, recent_tools: [], conversation_length: 0, user_id: "test" },
    description: "Report generation request"
  }
]

export async function runRouterTests(): Promise<void> {
  console.log('🧪 Starting Hybrid Learned Router Tests...\n')
  
  try {
    // Initialize the router
    console.log('🚀 Initializing router...')
    await hybridLearnedRouter.initialize()
    console.log('✅ Router initialized\n')
    
    let correct = 0
    let total = testCases.length
    const results: Array<{
      query: string
      expected: string
      actual: string
      confidence: number
      method: string
      correct: boolean
      processingTime: number
    }> = []
    
    // Run test cases
    for (const testCase of testCases) {
      console.log(`Testing: "${testCase.query}"`)
      console.log(`Expected: ${testCase.expectedIntent} (${testCase.description})`)
      
      const startTime = Date.now()
      const result = await routerService.classifyIntent(testCase.query, testCase.context)
      const processingTime = Date.now() - startTime
      
      const actualIntent = result.classification.intent
      const confidence = result.classification.confidence
      const method = (result as any).explanation?.method || 'unknown'
      const isCorrect = actualIntent === testCase.expectedIntent
      
      if (isCorrect) correct++
      
      results.push({
        query: testCase.query,
        expected: testCase.expectedIntent,
        actual: actualIntent,
        confidence,
        method,
        correct: isCorrect,
        processingTime
      })
      
      console.log(`Result: ${actualIntent} (confidence: ${confidence.toFixed(2)}, method: ${method}, time: ${processingTime}ms)`)
      console.log(`Status: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}\n`)
    }
    
    // Print summary
    console.log('📊 Test Results Summary:')
    console.log(`Accuracy: ${correct}/${total} (${(correct/total*100).toFixed(1)}%)`)
    console.log(`Average Confidence: ${(results.reduce((sum, r) => sum + r.confidence, 0) / total).toFixed(2)}`)
    console.log(`Average Processing Time: ${(results.reduce((sum, r) => sum + r.processingTime, 0) / total).toFixed(0)}ms`)
    
    // Method distribution
    const methodCounts: Record<string, number> = {}
    results.forEach(r => {
      methodCounts[r.method] = (methodCounts[r.method] || 0) + 1
    })
    console.log('\nMethod Distribution:')
    Object.entries(methodCounts).forEach(([method, count]) => {
      console.log(`  ${method}: ${count} (${(count/total*100).toFixed(1)}%)`)
    })
    
    // Incorrect predictions
    const incorrect = results.filter(r => !r.correct)
    if (incorrect.length > 0) {
      console.log('\n❌ Incorrect Predictions:')
      incorrect.forEach(r => {
        console.log(`  "${r.query}" -> ${r.actual} (expected: ${r.expected})`)
      })
    }
    
    // Get router metrics
    console.log('\n📈 Router Metrics:')
    const metrics = routerService.getMetrics()
    console.log(`Total Requests: ${metrics.total_requests}`)
    console.log(`Average Confidence: ${metrics.average_confidence.toFixed(2)}`)
    console.log(`Intent Distribution:`, metrics.intent_distribution)
    
    console.log('\n✅ Test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runRouterTests().catch(console.error)
}
