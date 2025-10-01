# Writer Agent System (DEPRECATED)

⚠️ **This file is outdated. The Writer Agent system has been replaced by Writer Agent V2.**

Please see `WRITER_AGENT_V2_README.md` for the current implementation.

---

## Legacy Documentation (for reference only)

A sophisticated document editing system that implements the prompt pack architecture for precise document manipulation with RAG integration and approval workflow.

## Overview

The Writer Agent system provides:
- **Precise document editing** with preview-only changes
- **RAG integration** for document context
- **Web search** when needed for current information
- **Approval workflow** - changes require user approval before applying
- **JSON-based operations** for reliable editor manipulation

## Architecture

The system follows a 6-step process:

1. **Route** → Determine task and source needs
2. **Retrieve** → Get RAG context and web data if needed
3. **Plan** → Create instruction JSON with context references
4. **Execute** → Generate preview operations (not saved)
5. **Summarize** → Show approval message with Approve/Deny buttons
6. **Apply/Revert** → Execute or discard changes based on user choice

## Components

### Core Files

- `src/lib/ai/writer-agent.ts` - Main Writer Agent class
- `src/app/api/writer-agent/route.ts` - API endpoint for Writer Agent
- `src/components/editor/WriterAgentChatPanel.tsx` - Chat interface for Writer Agent
- `src/components/editor/AIChatPanel.tsx` - Updated to integrate Writer Agent

### Key Features

#### 1. Router System
Determines the task type and what context is needed:
- `rewrite` - Rewrite selected text
- `summarize` - Create summary
- `extend` - Add content after selection
- `outline` - Create document outline
- `critique` - Provide feedback
- `fact_check` - Verify claims
- `reference_insert` - Add citations
- `compare` - Compare documents
- `table_create` - Create tables
- `table_edit` - Modify tables

#### 2. Context Retrieval
- **RAG first** - Uses your documents by default
- **Web search** - Only when explicitly needed or enabled
- **Document outline** - Extracts current document structure

#### 3. Preview Operations
All changes are preview-only until approved:
- `insert_after` - Insert content after anchor
- `replace_range` - Replace text in range
- `delete_range` - Remove text
- `format` - Apply formatting (bold, italic, etc.)
- `set_block_type` - Change to heading, paragraph, etc.
- `list_convert` - Convert to bullet/numbered list
- `table_set_cell` - Modify table cells

#### 4. Approval Workflow
- Shows preview of changes
- Lists sources used (your docs or web)
- Approve/Deny buttons
- No changes saved without approval

## Usage

### In the Editor

1. **Enable Writer Agent** - Click the edit icon (✏️) in the AI Chat Panel
2. **Select text** - Highlight text you want to edit
3. **Make request** - Ask for specific changes (e.g., "Make this more engaging")
4. **Review preview** - See what changes will be made
5. **Approve or deny** - Click Approve to apply or Deny to reject

### Example Requests

- "Rewrite this paragraph to be more engaging"
- "Summarize this section"
- "Add a conclusion after this paragraph"
- "Make this a bullet list"
- "Convert this to a table"
- "Add citations for these claims"
- "Make this text bold and italic"

## Integration

The Writer Agent integrates with your existing:
- **RAG system** - Uses your document knowledge base
- **Web search** - When enabled for current information
- **Editor** - Direct manipulation of document content
- **Chat system** - Seamless user experience

## Configuration

### Memory Settings
The system respects your existing preferences:
- Uses `gpt-4o-mini` as the default model
- RAG by default, web search only when explicitly requested
- No test code generation
- Concise responses

### Editor Operations
The system works with your existing editor structure:
- HTML-based content manipulation
- Markdown formatting support
- Table management
- List conversion
- Text formatting

## API Endpoints

### POST `/api/writer-agent`

Process Writer Agent requests:

```json
{
  "userAsk": "Rewrite this paragraph",
  "selectionText": "Selected text content",
  "filePath": "document.md",
  "recentTopics": ["writing", "editing"],
  "documentId": "doc-123",
  "action": "process"
}
```

Response:
```json
{
  "type": "preview",
  "data": {
    "pending_change_id": "change_1234567890",
    "ops": [...],
    "citations": [...],
    "summary": "Rewrote paragraph to be more engaging",
    "notes": "Used document context for tone matching"
  }
}
```

## Error Handling

The system includes comprehensive error handling:
- JSON parsing errors with fallbacks
- RAG retrieval failures
- Editor operation errors
- User-friendly error messages

## Testing

Run the test suite:
```typescript
import { testWriterAgent } from '@/lib/ai/writer-agent-test'

// Test the Writer Agent
await testWriterAgent()
```

## Future Enhancements

- More sophisticated editor operations
- Batch operation support
- Undo/redo integration
- Custom formatting rules
- Multi-document operations
- Collaborative editing support

## Troubleshooting

### Common Issues

1. **Writer Agent not responding**
   - Check if editorRef is properly passed
   - Verify user session is active
   - Check console for errors

2. **Preview operations not applying**
   - Ensure editorRef.current is not null
   - Check if onContentChange callback is working
   - Verify operation types are supported

3. **RAG context not loading**
   - Check documentId is valid
   - Verify RAG orchestrator is working
   - Check user permissions

### Debug Mode

Enable debug logging by setting:
```typescript
localStorage.setItem('writer-agent-debug', 'true')
```

This will show detailed logs of the Writer Agent process.

## Contributing

When modifying the Writer Agent system:

1. **Follow the prompt pack architecture** - Keep JSON schemas consistent
2. **Test all operations** - Ensure preview ops work correctly
3. **Maintain error handling** - Always provide fallbacks
4. **Update documentation** - Keep this README current
5. **Respect user preferences** - Follow existing memory settings

The Writer Agent system is designed to be reliable, user-friendly, and powerful. It provides precise document editing capabilities while maintaining user control through the approval workflow.
