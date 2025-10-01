/**
 * LLM Meta-Classifier Fallback
 * Uses dynamic few-shot prompting for edge cases when embeddings + classifier are uncertain
 */

import { generateChatCompletion } from './openai'
import { embeddingService } from './embedding-service'
import { IntentClassification } from './intent-schema'

interface MetaClassificationResult {
  classification: IntentClassification
  reasoning: string
  examplesUsed: Array<{ query: string; intent: string; similarity: number }>
  processingTime: number
}

export class LLMMetaClassifier {
  private static instance: LLMMetaClassifier
  private readonly confidenceThreshold = 0.6
  private readonly maxExamples = 5

  private constructor() {}

  static getInstance(): LLMMetaClassifier {
    if (!LLMMetaClassifier.instance) {
      LLMMetaClassifier.instance = new LLMMetaClassifier()
    }
    return LLMMetaClassifier.instance
  }

  /**
   * Classify using LLM with dynamic few-shot examples
   */
  async classify(
    query: string,
    context: any,
    confidenceThreshold: number = this.confidenceThreshold
  ): Promise<MetaClassificationResult> {
    const startTime = Date.now()

    try {
      // Get similar examples for few-shot prompting
      const similarExamples = await this.getSimilarExamples(query)
      
      // Build dynamic prompt with examples
      const prompt = this.buildDynamicPrompt(query, context, similarExamples)
      
      // Get LLM classification
      const response = await generateChatCompletion([
        { role: 'system', content: prompt.system },
        ...prompt.examples,
        { role: 'user', content: prompt.query }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 500
      })

      const result = response.choices[0]?.message?.content?.trim()
      if (!result) {
        throw new Error('No response from LLM meta-classifier')
      }

      // Parse the response
      const classification = this.parseClassificationResponse(result)
      
      return {
        classification,
        reasoning: this.extractReasoning(result),
        examplesUsed: similarExamples,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('LLM meta-classifier error:', error)
      
      // Return safe fallback
      return {
        classification: {
          intent: 'ask',
          confidence: 0.3,
          slots: {
            topic: this.extractTopic(query),
            needs_recency: false,
            target_docs: [],
            edit_target: null,
            outputs: 'answer'
          }
        },
        reasoning: 'Fallback due to classification error',
        examplesUsed: [],
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Get similar examples for few-shot prompting
   */
  private async getSimilarExamples(query: string): Promise<Array<{ query: string; intent: string; similarity: number }>> {
    const results = await embeddingService.searchSimilar(query, this.maxExamples)
    
    return results.map(result => ({
      query: result.metadata.query,
      intent: result.metadata.intent,
      similarity: result.similarity
    }))
  }

  /**
   * Build dynamic prompt with context and examples
   */
  private buildDynamicPrompt(
    query: string, 
    context: any, 
    examples: Array<{ query: string; intent: string; similarity: number }>
  ): { system: string; examples: Array<{ role: string; content: string }>; query: string } {
    
    const systemPrompt = `You are an expert intent classifier for an AI writing assistant. Your job is to classify user queries into the most appropriate intent category.

INTENT CATEGORIES:
- ask: General questions that can be answered from knowledge (e.g., "What is machine learning?", "Who is Daniel Ek?", "What is photosynthesis?")
- web_search: Questions requiring current/recent information or breaking news (e.g., "What's the latest news about Tesla?", "Did Daniel Ek step down as CEO?", "What happened today in the stock market?")
- rag_query: Questions about user's documents or files (e.g., "What does my research say about climate?")
- edit_request: Requests to modify existing text/content (e.g., "Rewrite this paragraph")
- editor_write: Requests to create new content (e.g., "Write an essay about renewable energy")
- other: Unclear or ambiguous requests

IMPORTANT DISTINCTIONS:
- "Who is [person]?" = ask (general biographical information)
- "Who founded [company]?" = ask (historical facts)
- "Did [person] step down as CEO?" = web_search (recent events/status changes)
- "Is [person] still CEO of [company]?" = web_search (current status)
- "Did [person] leave [company]?" = web_search (recent events)
- "What is [concept]?" = ask (general knowledge)
- "What's the latest news about [topic]?" = web_search (current information)
- "What is the current stock price of [company]?" = web_search (real-time financial data)
- "How much is [company] stock trading at?" = web_search (current market data)
- "What's [company]'s market value?" = web_search (current financial information)

KEY PATTERNS FOR WEB_SEARCH:
- Questions about recent status changes (stepping down, leaving, retiring)
- Questions about current positions or roles
- Questions about recent events or developments
- Questions using "Did", "Has", "Is [person] still", "Current status"
- Questions about current stock prices, market data, or financial information
- Questions about "current price", "stock price", "market value", "trading at"
- Questions about recent financial performance or earnings

CONTEXT SIGNALS:
- has_attached_docs: ${context.has_attached_docs}
- is_selection_present: ${context.is_selection_present}
- conversation_length: ${context.conversation_length}
- recent_tools: ${JSON.stringify(context.recent_tools || [])}

CONFIDENCE GUIDELINES:
- 0.9-1.0: Very clear intent with strong context signals
- 0.7-0.9: Clear intent with some ambiguity
- 0.5-0.7: Somewhat ambiguous, needs context
- 0.3-0.5: Very ambiguous, best guess
- 0.0-0.3: Extremely unclear

Respond with ONLY valid JSON matching this exact schema:
{
  "intent": "ask|web_search|rag_query|edit_request|editor_write|other",
  "confidence": 0.0-1.0,
  "slots": {
    "topic": "extracted topic or null",
    "needs_recency": true/false,
    "target_docs": ["doc_id1"] or [],
    "edit_target": "selection|file|section|null",
    "outputs": "answer|links|summary|diff|patch"
  },
  "reasoning": "Brief explanation of classification decision"
}`

    const exampleMessages = examples.map(example => [
      { role: 'user', content: example.user },
      { role: 'assistant', content: example.assistant }
    ]).flat()

    const queryMessage = `Classify this query: "${query}"

Context: ${JSON.stringify({
  has_attached_docs: context.has_attached_docs,
  is_selection_present: context.is_selection_present,
  conversation_length: context.conversation_length
})}`

    return {
      system: systemPrompt,
      examples: exampleMessages,
      query: queryMessage
    }
  }

  /**
   * Parse LLM response into classification
   */
  private parseClassificationResponse(response: string): IntentClassification {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      // Validate required fields
      if (!parsed.intent || !parsed.confidence || !parsed.slots) {
        throw new Error('Invalid classification structure')
      }

      // Ensure confidence is within bounds
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence))

      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        slots: {
          topic: parsed.slots.topic || null,
          needs_recency: Boolean(parsed.slots.needs_recency),
          target_docs: Array.isArray(parsed.slots.target_docs) ? parsed.slots.target_docs : [],
          edit_target: parsed.slots.edit_target || null,
          outputs: parsed.slots.outputs || 'answer'
        }
      }

    } catch (error) {
      console.error('Failed to parse LLM response:', response, error)
      
      // Return safe fallback
      return {
        intent: 'ask',
        confidence: 0.3,
        slots: {
          topic: null,
          needs_recency: false,
          target_docs: [],
          edit_target: null,
          outputs: 'answer'
        }
      }
    }
  }

  /**
   * Extract reasoning from LLM response
   */
  private extractReasoning(response: string): string {
    const reasoningMatch = response.match(/"reasoning":\s*"([^"]+)"/)
    return reasoningMatch ? reasoningMatch[1] : 'No reasoning provided'
  }

  /**
   * Extract topic from query (simple implementation)
   */
  private extractTopic(query: string): string | null {
    // Simple topic extraction - could be enhanced with NER
    const words = query.split(' ').filter(w => w.length > 3)
    return words.length > 0 ? words[0] : null
  }

  /**
   * Get classification confidence for a query without full classification
   */
  async getConfidence(query: string, context: any): Promise<number> {
    try {
      const result = await this.classify(query, context, 0)
      return result.classification.confidence
    } catch (error) {
      console.error('Confidence check failed:', error)
      return 0.3
    }
  }

  /**
   * Check if query should use meta-classifier (low confidence from other methods)
   */
  shouldUseMetaClassifier(
    query: string, 
    classifierConfidence: number, 
    embeddingConfidence: number
  ): boolean {
    const avgConfidence = (classifierConfidence + embeddingConfidence) / 2
    return avgConfidence < this.confidenceThreshold
  }
}

// Export singleton
export const llmMetaClassifier = LLMMetaClassifier.getInstance()
