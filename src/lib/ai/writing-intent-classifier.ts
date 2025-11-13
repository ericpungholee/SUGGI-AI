/**
 * Writing Workspace Intent Classifier
 * Classifies user requests into exactly ONE of 7 intents
 */

import { generateChatCompletion } from './openai'
import { getChatModel } from './core/models'

export type WritingIntent = 
  | 'GENERAL_CHAT'
  | 'DOC_QA_RAG'
  | 'WRITE_INLINE'
  | 'WRITE_LONGFORM'
  | 'FILE_OP'
  | 'WEB_SEARCH'
  | 'AGENT_TASK'

export interface IntentClassificationResult {
  intent: WritingIntent
  confidence: number
  reasoning?: string
}

export interface ClassificationContext {
  hasDocumentId: boolean
  hasSelection: boolean
  selectionLength: number
  hasDocumentContent: boolean
  conversationLength: number
  userId: string
  documentId?: string
}

/**
 * Classify user request into exactly ONE intent
 */
export async function classifyWritingIntent(
  message: string,
  context: ClassificationContext
): Promise<IntentClassificationResult> {
  const startTime = Date.now()
  
  try {
    // Fast path for greetings
    if (isGreeting(message)) {
      return {
        intent: 'GENERAL_CHAT',
        confidence: 1.0,
        reasoning: 'Greeting detected'
      }
    }

    // Fast path for file operations
    const fileOpIntent = detectFileOperation(message)
    if (fileOpIntent) {
      return {
        intent: 'FILE_OP',
        confidence: 0.9,
        reasoning: 'File operation keywords detected'
      }
    }

    // Use LLM for classification
    const classificationPrompt = buildClassificationPrompt(message, context)
    
    const response = await generateChatCompletion([
      {
        role: 'system',
        content: `You are an intent classifier for a writing workspace. Classify user requests into EXACTLY ONE intent.

INTENTS:
1. GENERAL_CHAT - General conversation, Q&A, or casual chat. No RAG, no writing, no search unless explicitly asked.
2. DOC_QA_RAG - User asks about information inside their stored documents. Requires embedding search across internal docs.
3. WRITE_INLINE - Rewrite, edit, improve, shorten, expand, continue, or DELETE/CLEAR specific user-provided text or document content. Only transform the given or selected text.
4. WRITE_LONGFORM - Create substantial new writing (essays, reports, outlines, blog posts). May use RAG if topic relates to user docs, or Web search ONLY if explicitly requested.
5. FILE_OP - Create, rename, delete, list, or open documents. No content generation unless part of writing tasks.
6. WEB_SEARCH - User explicitly wants external information or factual sources. Requires using web search tool.
7. AGENT_TASK - Multi-step tasks that intentionally chain multiple capabilities (RAG → analyze → write, Web search → summarize → write, etc.)

RULES:
- Classify into EXACTLY ONE intent
- WRITE_INLINE: User provides specific text to transform (selection, paragraph, etc.) OR wants to delete/clear/empty document content
- WRITE_LONGFORM: User wants to create new substantial content
- DOC_QA_RAG: User asks "what does my document say about X" or similar
- WEB_SEARCH: User explicitly asks for current/external information
- AGENT_TASK: Complex multi-step workflows that need both RAG and Web Search
- GENERAL_CHAT: Everything else that doesn't fit above

Respond with ONLY a JSON object: {"intent": "INTENT_NAME", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`
      },
      {
        role: 'user',
        content: classificationPrompt
      }
    ], {
      model: getChatModel(),
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content?.trim() || '{}'
    let result: IntentClassificationResult

    try {
      result = JSON.parse(content)
    } catch {
      // Fallback parsing
      const intentMatch = content.match(/"intent"\s*:\s*"([^"]+)"/i)
      const confidenceMatch = content.match(/"confidence"\s*:\s*([0-9.]+)/i)
      
      result = {
        intent: (intentMatch?.[1] as WritingIntent) || 'GENERAL_CHAT',
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: 'Parsed from fallback'
      }
    }

    // Validate intent
    const validIntents: WritingIntent[] = [
      'GENERAL_CHAT',
      'DOC_QA_RAG',
      'WRITE_INLINE',
      'WRITE_LONGFORM',
      'FILE_OP',
      'WEB_SEARCH',
      'AGENT_TASK'
    ]

    if (!validIntents.includes(result.intent)) {
      result.intent = 'GENERAL_CHAT'
      result.confidence = 0.5
    }

    return result
  } catch (error) {
    console.error('Intent classification error:', error)
    
    // Fallback classification based on keywords
    return fallbackClassification(message, context)
  }
}

function buildClassificationPrompt(message: string, context: ClassificationContext): string {
  return `Classify this user request:

User Message: "${message}"

Context:
- Has Document: ${context.hasDocumentId}
- Has Selection: ${context.hasSelection} (${context.selectionLength} chars)
- Has Document Content: ${context.hasDocumentContent}
- Conversation Length: ${context.conversationLength} messages

Classify into EXACTLY ONE intent.`
}

function isGreeting(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (text.length > 30) return false
  
  const patterns = [
    /^hi[!.\s]*$/i,
    /^hello[!.\s]*$/i,
    /^hey[!.\s]*$/i,
    /^(yo|sup|hola)[!.\s]*$/i,
    /^hi there[!.\s]*$/i,
    /^hello there[!.\s]*$/i,
    /^hey there[!.\s]*$/i,
    /^good (morning|afternoon|evening)[!.\s]*$/i
  ]
  
  return patterns.some(p => p.test(text))
}

function detectFileOperation(message: string): boolean {
  const text = message.toLowerCase()
  const fileOpKeywords = [
    'create file', 'new file', 'open file', 'delete file', 'rename file',
    'list files', 'show files', 'create document', 'new document',
    'open document', 'delete document', 'rename document', 'list documents'
  ]
  
  return fileOpKeywords.some(keyword => text.includes(keyword))
}

function fallbackClassification(
  message: string,
  context: ClassificationContext
): IntentClassificationResult {
  const text = message.toLowerCase()
  
  // Check for delete/clear commands - these should be WRITE_INLINE to actually edit the document
  const deleteKeywords = ['delete all', 'clear all', 'remove all', 'empty', 'wipe', 'delete everything', 'clear everything', 'remove everything', 'delete content', 'clear content']
  const hasDeleteKeywords = deleteKeywords.some(kw => text.includes(kw))
  
  if (hasDeleteKeywords && context.hasDocumentId) {
    return { intent: 'WRITE_INLINE', confidence: 0.9, reasoning: 'Delete/clear command with document context' }
  }
  
  // Check for writing keywords
  const writeKeywords = ['write', 'create', 'generate', 'compose', 'draft', 'report', 'document', 'essay', 'article', 'blog']
  const hasWriteKeywords = writeKeywords.some(kw => text.includes(kw))
  
  // Check for inline edit keywords
  const inlineKeywords = ['rewrite', 'edit', 'improve', 'shorten', 'expand', 'continue', 'fix', 'correct', 'change']
  const hasInlineKeywords = inlineKeywords.some(kw => text.includes(kw))
  
  // Check for RAG keywords
  const ragKeywords = ['what does', 'what is in', 'tell me about', 'find in', 'search my', 'my document', 'my documents']
  const hasRagKeywords = ragKeywords.some(kw => text.includes(kw))
  
  // Check for web search keywords
  const webKeywords = ['current', 'latest', 'recent', 'today', 'now', 'search web', 'web search', 'google', 'find online']
  const hasWebKeywords = webKeywords.some(kw => text.includes(kw))
  
  // Check for file operations
  const fileKeywords = ['create file', 'new file', 'open file', 'delete file', 'rename file', 'list files']
  const hasFileKeywords = fileKeywords.some(kw => text.includes(kw))
  
  // Decision logic
  if (hasFileKeywords) {
    return { intent: 'FILE_OP', confidence: 0.8, reasoning: 'File operation keywords' }
  }
  
  if (hasWebKeywords && !hasWriteKeywords) {
    return { intent: 'WEB_SEARCH', confidence: 0.8, reasoning: 'Web search keywords' }
  }
  
  if (hasRagKeywords && context.hasDocumentId) {
    return { intent: 'DOC_QA_RAG', confidence: 0.8, reasoning: 'RAG keywords with document context' }
  }
  
  if (hasInlineKeywords && context.hasSelection) {
    return { intent: 'WRITE_INLINE', confidence: 0.8, reasoning: 'Inline edit keywords with selection' }
  }
  
  if (hasWriteKeywords) {
    return { intent: 'WRITE_LONGFORM', confidence: 0.7, reasoning: 'Writing keywords' }
  }
  
  return { intent: 'GENERAL_CHAT', confidence: 0.6, reasoning: 'Default fallback' }
}

