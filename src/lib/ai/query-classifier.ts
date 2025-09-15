import { generateChatCompletion, ChatMessage } from './openai'

export interface QueryClassification {
  isGeneralKnowledge: boolean
  isFollowUp: boolean
  isEditRequest: boolean
  confidence: number
  reasoning: string
}

/**
 * Use AI to intelligently classify user queries
 */
export async function classifyQuery(
  message: string,
  documentId?: string,
  conversationHistory: ChatMessage[] = []
): Promise<QueryClassification> {
  try {
    const systemPrompt = `You are a query classification assistant. Analyze the user's message and determine its intent.

Classify the query into these categories:

1. **isGeneralKnowledge**: True if the query is asking about general knowledge, facts, or information not specific to any document (e.g., "What is React?", "Who is Elon Musk?", "How does machine learning work?")

2. **isFollowUp**: True if the query is a simple follow-up or continuation (e.g., "tell me more", "what else", "and then?", "them", "it", "this")

3. **isEditRequest**: True if the user wants to edit, modify, or generate content for their document (e.g., "write an essay", "improve this", "add a section", "fix grammar", "create content"). NOT for questions asking about existing content (e.g., "what technology was used", "which framework", "how does this work")

4. **confidence**: A number from 0-1 indicating how confident you are in this classification

5. **reasoning**: A brief explanation of why you classified it this way

IMPORTANT RULES:
- If the query references "this document", "this project", "this file", "this text", or similar document-specific terms, it's likely NOT general knowledge
- If the query asks about specific content, data, or details that would be found in a document, it's likely NOT general knowledge
- If the query is asking "what", "which", "how", "why" about something specific to the current context, it's likely NOT general knowledge
- Only classify as general knowledge if it's asking about broad concepts, famous people, general facts, or topics not specific to any document

EDIT REQUEST vs DOCUMENT QUERY:
- EDIT REQUEST: "Write an essay about...", "Add a section on...", "Improve this paragraph", "Fix the grammar", "Create content for..."
- DOCUMENT QUERY: "What technology was used?", "Which framework is this?", "How does this work?", "What are the key features?", "Which tech was used for this project?"

Respond with a JSON object containing these fields.`

    const userPrompt = `Classify this query: "${message}"

Context: ${documentId ? 'User is working with a document' : 'No document context'}

Previous conversation:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const response = await generateChatCompletion(messages, {
      model: 'gpt-4o-mini', // Use a fast, cheap model for classification
      temperature: 0.1, // Low temperature for consistent classification
      max_tokens: 200
    })

    // Parse the JSON response
    try {
      const content = response.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in response')
      }
      
      console.log('AI Classification Response:', content)
      
      const classification = JSON.parse(content)
      return {
        isGeneralKnowledge: Boolean(classification.isGeneralKnowledge),
        isFollowUp: Boolean(classification.isFollowUp),
        isEditRequest: Boolean(classification.isEditRequest),
        confidence: Number(classification.confidence) || 0.5,
        reasoning: classification.reasoning || 'No reasoning provided'
      }
    } catch (parseError) {
      console.warn('Failed to parse query classification, using fallback:', parseError)
      console.warn('Response content was:', response.choices?.[0]?.message?.content)
      return fallbackClassification(message)
    }
  } catch (error) {
    console.warn('Query classification failed, using fallback:', error)
    return fallbackClassification(message)
  }
}

/**
 * Fallback classification using simple heuristics
 */
function fallbackClassification(message: string): QueryClassification {
  const lowerMessage = message.toLowerCase().trim()
  
  // Check for edit requests first (must be action verbs, not question words)
  const editActionVerbs = ['write', 'create', 'generate', 'edit', 'improve', 'fix', 'add', 'remove', 'compose', 'draft', 'rewrite', 'modify', 'change', 'update']
  const questionWords = ['what', 'which', 'how', 'why', 'when', 'where', 'who']
  
  const hasEditAction = editActionVerbs.some(verb => lowerMessage.includes(verb))
  const isQuestion = questionWords.some(word => lowerMessage.startsWith(word) || lowerMessage.includes(' ' + word))
  
  // Only consider it an edit request if it has action verbs AND is not a question
  const isEditRequest = hasEditAction && !isQuestion
  
  // Check for follow-up queries (very short or specific follow-up phrases)
  const isFollowUp = lowerMessage.length < 10 || 
    ['tell me more', 'what else', 'and then', 'continue', 'go on'].some(phrase => 
      lowerMessage.includes(phrase)
    ) ||
    // Very short responses that are likely follow-ups
    (lowerMessage.length < 20 && ['them', 'it', 'this', 'that', 'yes', 'no', 'ok'].some(word =>
      lowerMessage === word || lowerMessage.startsWith(word + ' ')
    ))
  
  // Check for document-specific queries
  const isDocumentSpecific = lowerMessage.includes('this document') ||
    lowerMessage.includes('this project') ||
    lowerMessage.includes('this file') ||
    lowerMessage.includes('this text') ||
    lowerMessage.includes('the document') ||
    lowerMessage.includes('the project') ||
    lowerMessage.includes('in this') ||
    lowerMessage.includes('from this') ||
    lowerMessage.includes('about this') ||
    lowerMessage.includes('which') && lowerMessage.includes('this') ||
    lowerMessage.includes('what') && lowerMessage.includes('this')
  
  const isGeneralKnowledge = !isFollowUp && !isEditRequest && !isDocumentSpecific
  
  return {
    isGeneralKnowledge,
    isFollowUp,
    isEditRequest,
    confidence: 0.3, // Low confidence for fallback
    reasoning: 'Fallback classification using simple heuristics'
  }
}
