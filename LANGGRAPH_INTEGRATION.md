# LangGraph Integration for Agentic Editing

This document describes the implementation of LangGraph for improved agentic editing in the SUGGI-AI project.

## Overview

The LangGraph integration replaces the previous simple keyword-based edit detection with a sophisticated agent-based system that provides:

- **Consistent edit request detection** using LLM-based analysis
- **Centralized state management** for edit workflows
- **Conversation memory** for context-aware editing
- **Modular workflow orchestration** with clear separation of concerns

## Architecture

### Core Components

1. **LangGraph Edit Agent** (`src/lib/ai/langgraph-edit-agent.ts`)
   - Main orchestrator for edit workflows
   - Implements a state graph with multiple nodes
   - Handles edit detection, planning, and execution

2. **Conversation Memory** (`src/lib/ai/conversation-memory.ts`)
   - Maintains conversation context across edit requests
   - Tracks edit history and user preferences
   - Provides context-aware editing suggestions

3. **Enhanced Edit Workflow Hook** (`src/hooks/useLangGraphEditWorkflow.ts`)
   - React hook that integrates LangGraph with the UI
   - Provides real-time state updates and progress tracking
   - Handles conversation memory integration

### Workflow Nodes

The LangGraph agent implements the following nodes:

1. **Detect Edit Request**
   - Analyzes user messages to determine if they're edit requests
   - Extracts intent, scope, and guardrails
   - Provides confidence scoring

2. **Plan Edit Strategy**
   - Creates detailed editing plans based on user intent
   - Considers document context and user preferences
   - Determines approach (surgical vs. comprehensive)

3. **Generate Edit Hunks**
   - Creates precise diff hunks for document modifications
   - Respects guardrails and user preferences
   - Validates edit quality and consistency

4. **Create Edit Proposal**
   - Packages edits into a complete proposal
   - Includes metadata and summary information
   - Prepares for user review and approval

## Key Improvements

### 1. Consistent Edit Detection

**Before:**
```typescript
// Simple keyword matching
const editingKeywords = ['edit', 'improve', 'fix', 'change', ...]
const isEditRequest = editingKeywords.some(keyword => lowerMessage.includes(keyword))
```

**After:**
```typescript
// LLM-based analysis with confidence scoring
const result = await llm.invoke([
  new SystemMessage(systemPrompt),
  new HumanMessage(state.userMessage)
])
const analysis = JSON.parse(response.content)
// Returns: { isEditRequest: boolean, intent: string, confidence: number, ... }
```

### 2. Centralized State Management

**Before:**
- State scattered across multiple components
- Inconsistent state updates
- No conversation context

**After:**
```typescript
interface EditAgentState {
  userMessage: string
  documentId: string
  documentContent: string
  conversationHistory: BaseMessage[]
  editRequest: EditRequest | null
  detectedIntent: string
  confidence: number
  editPlan: EditPlan | null
  editHunks: TextDiffHunk[]
  proposal: EditProposal | null
  processingStep: string
  // ... more structured state
}
```

### 3. Conversation Memory

The system now maintains conversation context:

```typescript
const context = await conversationMemory.getRelevantContext(
  conversationId,
  documentId,
  userId,
  currentMessage
)

// Returns:
// - Recent messages
// - Edit patterns from history
// - User preferences
// - Document context
```

### 4. Enhanced User Experience

**Real-time Progress Tracking:**
```typescript
// Shows detailed progress through the edit workflow
switch (processingStep) {
  case 'edit_detected':
    return `Detected edit request: ${detectedIntent} (${confidence}% confidence)`
  case 'plan_created':
    return `Planning ${editPlan.approach} edits...`
  case 'hunks_generated':
    return 'Generating edit proposals...'
  // ...
}
```

## API Changes

### Updated Endpoints

1. **POST /api/ai/edit/propose**
   - Now accepts `userMessage` and `conversationId` instead of structured edit request
   - Uses LangGraph for processing
   - Returns enhanced proposal with metadata

2. **POST /api/ai/chat**
   - Integrated edit detection using LangGraph
   - Automatically routes edit requests to edit workflow
   - Maintains conversation context

### New Request Format

**Before:**
```typescript
{
  documentId: string,
  scope: 'selection' | 'document',
  userIntent: string,
  guardrails: { ... }
}
```

**After:**
```typescript
{
  documentId: string,
  userMessage: string,
  conversationId?: string
}
```

## Usage Examples

### Basic Edit Request

```typescript
const result = await processEditRequest(
  "Fix the grammar and improve clarity",
  "doc-123",
  "This is a test document with some errors.",
  conversationHistory
)

if (result.proposal) {
  // Handle edit proposal
  console.log(`Generated ${result.editHunks.length} edits`)
  console.log(`Confidence: ${result.confidence}`)
  console.log(`Intent: ${result.detectedIntent}`)
}
```

### Using the React Hook

```typescript
const editWorkflow = useLangGraphEditWorkflow({
  documentId: 'doc-123',
  conversationId: 'conv-456',
  userId: 'user-789',
  onContentChange: (newContent) => {
    // Update document content
  }
})

// Start edit workflow
await editWorkflow.startEditWorkflow(
  "Make this more professional",
  currentDocumentContent
)

// Check progress
console.log(editWorkflow.processingStep) // 'edit_detected', 'plan_created', etc.
console.log(editWorkflow.confidence) // 0.95
console.log(editWorkflow.detectedIntent) // 'improve tone'
```

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key
# LangGraph uses the same OpenAI configuration
```

### Model Configuration

The system uses `gpt-4o-mini` by default for better performance and cost efficiency:

```typescript
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 4000,
})
```

## Testing

Run the integration test:

```typescript
import { testLangGraphIntegration } from '@/lib/ai/test-langgraph-integration'

// Test various edit scenarios
await testLangGraphIntegration()
```

## Migration Guide

### For Existing Code

1. **Update Edit Workflow Hooks:**
   ```typescript
   // Old
   import { useEditWorkflow } from '@/hooks/useEditWorkflow'
   
   // New
   import { useLangGraphEditWorkflow } from '@/hooks/useLangGraphEditWorkflow'
   ```

2. **Update API Calls:**
   ```typescript
   // Old
   fetch('/api/ai/edit/propose', {
     body: JSON.stringify({
       documentId,
       scope: 'document',
       userIntent: 'improve clarity',
       guardrails: { ... }
     })
   })
   
   // New
   fetch('/api/ai/edit/propose', {
     body: JSON.stringify({
       documentId,
       userMessage: 'improve clarity',
       conversationId: 'conv-123'
     })
   })
   ```

3. **Handle New State Properties:**
   ```typescript
   // Access new LangGraph state
   console.log(editWorkflow.processingStep)
   console.log(editWorkflow.confidence)
   console.log(editWorkflow.detectedIntent)
   console.log(editWorkflow.editPlan)
   ```

## Benefits

1. **Improved Accuracy**: LLM-based edit detection is more accurate than keyword matching
2. **Better Context Awareness**: Conversation memory provides better understanding of user intent
3. **Consistent State Management**: Centralized state reduces bugs and inconsistencies
4. **Enhanced User Experience**: Real-time progress tracking and detailed feedback
5. **Modular Architecture**: Easy to extend and modify individual workflow steps
6. **Better Error Handling**: Comprehensive error handling and recovery mechanisms

## Future Enhancements

1. **Multi-step Edit Workflows**: Support for complex editing tasks that require multiple steps
2. **Learning from User Feedback**: Improve edit quality based on user acceptance/rejection patterns
3. **Custom Edit Strategies**: Allow users to define custom editing approaches
4. **Batch Processing**: Support for processing multiple documents simultaneously
5. **Integration with External Tools**: Support for additional editing tools and services

## Troubleshooting

### Common Issues

1. **High Memory Usage**: The conversation memory cache can grow large. Monitor cache size and clear if needed.

2. **Slow Edit Detection**: If edit detection is slow, consider reducing the conversation history length or optimizing the LLM prompts.

3. **Inconsistent Results**: Ensure the document content is properly extracted and the conversation history is accurate.

### Debug Mode

Enable debug logging by setting the environment variable:
```env
DEBUG_LANGGRAPH=true
```

This will provide detailed logs of the LangGraph workflow execution.
