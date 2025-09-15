// Simple test for LangGraph functionality
const { processEditRequest } = require('./src/lib/ai/langgraph-edit-agent.ts');

async function testLangGraph() {
  console.log('🧪 Testing LangGraph Edit Agent...');
  
  try {
    const result = await processEditRequest(
      'Fix the grammar in this text',
      'test-doc-123',
      'This is a test document with some grammer errors.',
      []
    );
    
    console.log('✅ LangGraph test result:', {
      isEditRequest: !!result.editRequest,
      detectedIntent: result.detectedIntent,
      confidence: result.confidence,
      processingStep: result.processingStep,
      hasProposal: !!result.proposal,
      hunkCount: result.editHunks?.length || 0,
      error: result.error
    });
    
    if (result.editHunks && result.editHunks.length > 0) {
      console.log('📋 Generated Hunks:');
      result.editHunks.forEach((hunk, index) => {
        console.log(`  ${index + 1}. ${hunk.label} (${hunk.changeType})`);
        console.log(`     From: ${hunk.from}, To: ${hunk.to}`);
        console.log(`     Replacement: "${hunk.replacement.substring(0, 50)}..."`);
      });
    }
    
  } catch (error) {
    console.error('❌ LangGraph test failed:', error);
  }
}

testLangGraph();
