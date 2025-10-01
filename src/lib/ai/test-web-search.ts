/**
 * Test script for web search functionality
 */

import { performWebSearch } from './web-search-fallback'

async function testWebSearch() {
  console.log('🧪 Testing Web Search Fallback...')
  
  try {
    const result = await performWebSearch('what is the current price of Spotify stock', {
      force_web_search: true,
      timeout_seconds: 10
    })
    
    console.log('✅ Web Search Test Results:')
    console.log('Text Length:', result.text.length)
    console.log('Citations Count:', result.citations.length)
    console.log('First 200 chars:', result.text.substring(0, 200) + '...')
    console.log('Citations:', result.citations)
    
    return result
  } catch (error) {
    console.error('❌ Web Search Test Failed:', error)
    throw error
  }
}

// Export for testing
export { testWebSearch }

// Run test if called directly
if (require.main === module) {
  testWebSearch().catch(console.error)
}
