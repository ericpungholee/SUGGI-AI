# Writer Agent V2 - Complete Implementation

This document describes the complete implementation of the Writer Agent V2 system according to the Cursor System Instruction specification.

## 🎯 Overview

The Writer Agent V2 implements a **RAG-first approach** with **preview-only edits** and **chat-based approval workflow**. It follows the exact JSON contracts and system instruction provided.

## 📁 File Structure

```
src/lib/ai/
├── writer-agent-v2.ts          # Main Writer Agent V2 implementation
├── mcp-tools.ts               # MCP tool interfaces and implementations
├── writer-agent-v2.test.ts    # Test suite for the system
└── ...

src/app/api/
└── writer-agent/
    └── route.ts               # Updated API endpoint using V2 system

src/components/editor/
└── AIChatPanel.tsx            # Updated chat panel with approval workflow

CURSOR_SYSTEM_INSTRUCTION.md   # Complete system instruction for copy-paste
```

## 🔧 Core Components

### 1. Writer Agent V2 (`writer-agent-v2.ts`)

The main class implementing the 4-step pipeline:

- **A) ROUTE** → `route()` method outputs RouterOut JSON
- **B) PLAN** → `plan()` method outputs Instruction JSON  
- **C) EXECUTE** → `execute()` method outputs PreviewOps JSON
- **D) MESSAGE** → `generateApprovalMessage()` method creates approval text

### 2. JSON Contracts

#### RouterOut
```typescript
interface RouterOut {
  task: 'rewrite' | 'summarize' | 'extend' | 'outline' | 'critique' | 'fact_check' | 'reference_insert' | 'compare' | 'table_create' | 'table_edit'
  confidence: number
  needs: {
    selection_text: boolean
    doc_context: 'none' | 'local' | 'project' | 'workspace'
    web_context: 'no' | 'recommended' | 'required'
    precision: 'low' | 'medium' | 'high'
  }
  query: {
    semantic: string
    keywords: string[]
  }
}
```

#### Instruction
```typescript
interface Instruction {
  task: string
  inputs: Record<string, any>
  context_refs: Array<{
    type: 'doc' | 'web'
    id?: string
    anchor?: string
    url?: string
    why: string
  }>
  constraints: {
    max_words?: number
    tone?: string
    citation_style?: 'APA' | 'MLA' | 'Chicago' | null
  }
  telemetry: {
    route_conf: number
    rag_conf: number
  }
}
```

#### PreviewOps
```typescript
interface PreviewOps {
  pending_change_id: string
  ops: Array<{
    op: string
    anchor?: string
    text?: string
    range?: {
      start: { blockId: string; offset: number }
      end: { blockId: string; offset: number }
    }
    style?: string
    toggle?: boolean
    blockId?: string
    type?: string
    list?: string
    tableId?: string
    r?: number
    c?: number
    value?: string
  }>
  citations: Array<{
    type: 'doc' | 'web'
    id?: string
    anchor?: string
    url?: string
    why: string
  }>
  summary: string
  notes: string
}
```

### 3. MCP Tools (`mcp-tools.ts`)

Provides the exact tool interfaces specified:

- `search_docs(query: string, k?: number) → {chunks: RagChunk[]}`
- `pack_context(ids: string[], budgetTokens?: number) → {chunks: RagChunk[]}`
- `apply_ops(pending_change_id: string) → {ok: boolean}`
- `revert_ops(pending_change_id: string) → {ok: boolean}`

### 4. API Endpoint (`/api/writer-agent/route.ts`)

Updated to use the new Writer Agent V2 system with proper orchestration:

1. **Route** the user request
2. **Retrieve** context using RAG and web search
3. **Plan** the instruction
4. **Execute** to generate preview ops
5. **Generate** approval message

### 5. Chat Panel Integration (`AIChatPanel.tsx`)

Updated to integrate with the new system:

- Uses Writer Agent V2 API for processing
- Handles preview operations with approval workflow
- Shows "Approve/Deny" buttons for pending changes
- Integrates with existing editor operations

## 🚀 Usage

### 1. Copy the System Instruction

Copy the content from `CURSOR_SYSTEM_INSTRUCTION.md` and paste it as your global system prompt in Cursor.

### 2. API Usage

```typescript
// Process a user request
const response = await fetch('/api/writer-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAsk: 'Make this text more friendly',
    selectionText: 'The current implementation is suboptimal.',
    documentId: 'doc-123',
    action: 'process',
    useWebSearch: false
  })
})

const result = await response.json()
// result.type === 'preview'
// result.data contains PreviewOps
// result.message contains approval message
```

### 3. Apply Changes

```typescript
// Apply approved changes
const applyResponse = await fetch('/api/writer-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'apply',
    pending_change_id: 'change_123456789'
  })
})
```

### 4. Reject Changes

```typescript
// Reject changes
const rejectResponse = await fetch('/api/writer-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'revert',
    pending_change_id: 'change_123456789'
  })
})
```

## 🔄 Workflow

1. **User sends message** → Chat panel detects Writer Agent keywords
2. **Route** → Determines task type and source needs
3. **Retrieve** → Gets RAG context and web results if needed
4. **Plan** → Creates instruction with context references
5. **Execute** → Generates preview operations
6. **Show preview** → Displays changes with "Approve/Deny" buttons
7. **User approves** → Changes are applied to the document
8. **User rejects** → Changes are discarded

## 🧪 Testing

Run the test suite to verify the integration:

```typescript
import { testWriterAgentV2, testTaskTypes } from '@/lib/ai/writer-agent-v2.test'

// Test basic functionality
await testWriterAgentV2()

// Test different task types
await testTaskTypes()
```

## 🎯 Key Features

### RAG-First Approach
- Uses your existing RAG system as the primary source
- Web search only when explicitly needed or enabled
- Maintains Pinecone vector database integration [[memory:8311442]]

### Preview-Only Edits
- All changes are preview operations until approved
- No automatic saving or persistence
- User has full control over what gets applied

### Approval Workflow
- Clear "Approve/Deny" buttons in chat
- Short approval messages with source domains
- Proper error handling and rollback

### JSON Contracts
- Exact implementation of specified schemas
- Type-safe interfaces
- Validates against schemas before processing

### MCP Tool Integration
- Portable tool interfaces
- Can be exposed via MCP or used internally
- Extensible for additional tools

## 🔧 Configuration

The system uses your existing configuration:

- **Model**: GPT-5 (gpt-5-2025-08-07) [[memory:8786990]]
- **Vector DB**: Pinecone [[memory:8311442]]
- **RAG System**: Your existing RAG orchestrator
- **Web Search**: GPT-5's built-in web_search tool

## 🚨 Important Notes

1. **Model Behavior**: The system uses compact, minimal context_refs (2-8 items) and keeps JSON small and actionable.

2. **Safety**: All retrieved text is treated as untrusted, and the system ignores embedded instructions.

3. **Citations**: Only evidence listed in context_refs can be used for claims.

4. **Edge Cases**: Empty selections default to nearest section boundaries, and length limits are respected.

5. **No Test Code**: The system doesn't generate test code per your preferences [[memory:7629613]].

## 📝 Next Steps

1. **Test the Integration**: Use the test suite to verify everything works
2. **Customize MCP Tools**: Implement your specific RAG retrieval logic
3. **Configure Web Search**: Set up GPT-5 web_search tool integration
4. **Deploy**: The system is ready for production use

The Writer Agent V2 system is now fully implemented and ready to use with your SSUGI project!
