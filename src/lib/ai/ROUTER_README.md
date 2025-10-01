# Hybrid LLM Router System

A robust intent classification system that combines LLM-based classification with heuristics and embeddings for accurate routing of user requests.

## Architecture

### Core Components

1. **Intent Schema** (`intent-schema.ts`)
   - Defines the classification structure with confidence scoring
   - Supports 5 intents: `ask`, `web_search`, `rag_query`, `edit_request`, `other`
   - Includes slots for topic, recency needs, target docs, edit targets, and outputs

2. **Hybrid Router** (`hybrid-router.ts`)
   - Combines LLM classification with deterministic heuristics
   - Fast-path heuristics for obvious cases (edit requests, volatile queries)
   - LLM-based classification with confidence scoring
   - Second-opinion fallback for low-confidence cases

3. **Router Service** (`router-service.ts`)
   - Stateless service providing clean API for intent classification
   - Built-in metrics and observability
   - Singleton pattern for consistent state management

## Usage

### Basic Classification

```typescript
import { routerService } from '@/lib/ai/router-service'

const result = await routerService.classifyIntent(query, {
  has_attached_docs: true,
  doc_ids: ['doc1', 'doc2'],
  is_selection_present: false,
  selection_length: 0,
  recent_tools: [],
  conversation_length: 2,
  user_id: 'user123',
  document_id: 'doc1'
})

console.log(result.classification.intent) // 'rag_query'
console.log(result.classification.confidence) // 0.85
```

### Quick Classification

```typescript
const { intent, confidence } = await routerService.quickClassify(
  "What's the latest news about Tesla?",
  false, // hasDocs
  false  // hasSelection
)
```

## Intent Types

- **`ask`**: General questions answered from knowledge
- **`web_search`**: Questions requiring current/recent information
- **`rag_query`**: Questions about user's documents
- **`edit_request`**: Requests to modify existing text/content
- **`other`**: Unclear or ambiguous requests

## Features

### Heuristic Fast Paths
- Edit requests: Detects "rewrite", "edit", "polish", etc.
- Volatile queries: Detects "latest", "today", "breaking", etc.
- Document-specific: Detects "this doc", "my files", etc.

### LLM Classification
- Uses GPT-4o-mini for cost efficiency
- Few-shot examples for better accuracy
- Confidence scoring with threshold (0.7)
- Second opinion for low-confidence cases

### Observability
- Built-in metrics collection
- Processing time tracking
- Intent distribution analysis
- Confidence score monitoring

## API Endpoints

- `POST /api/chat` - Main chat endpoint (uses router)
- `GET /api/router/metrics` - Router performance metrics

## Configuration

The router can be configured by modifying the `HybridRouter` class:

```typescript
private confidenceThreshold = 0.7
private docSimilarityThreshold = 0.55
private volatileKeywords = /\b(latest|today|breaking|...)\b/i
private editKeywords = /\b(rewrite|edit|polish|...)\b/i
```

## Performance

- Heuristic fast paths: ~1ms
- LLM classification: ~200-500ms
- Second opinion: ~200-500ms
- Total processing: ~200-1000ms

## Monitoring

Access router metrics at `/api/router/metrics`:

```json
{
  "total_requests": 1250,
  "average_confidence": 0.82,
  "intent_distribution": {
    "ask": 450,
    "web_search": 300,
    "rag_query": 350,
    "edit_request": 100,
    "other": 50
  },
  "performance_stats": {
    "avg_time": 350,
    "max_time": 1200,
    "min_time": 50
  }
}
```
