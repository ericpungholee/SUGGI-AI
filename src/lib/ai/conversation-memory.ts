import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

export interface ConversationContext {
  conversationId: string
  documentId: string
  userId: string
  messages: BaseMessage[]
  editHistory: EditHistoryEntry[]
  lastEditRequest?: string
  documentVersion: number
}

export interface EditHistoryEntry {
  id: string
  timestamp: Date
  userIntent: string
  editType: 'grammar' | 'clarity' | 'tone' | 'structure' | 'content'
  changesApplied: number
  success: boolean
  userFeedback?: 'positive' | 'negative' | 'neutral'
}

export class ConversationMemory {
  private static instance: ConversationMemory
  private memoryCache: Map<string, ConversationContext> = new Map()
  private readonly MAX_CACHE_SIZE = 100
  private readonly MAX_MESSAGE_HISTORY = 20

  static getInstance(): ConversationMemory {
    if (!ConversationMemory.instance) {
      ConversationMemory.instance = new ConversationMemory()
    }
    return ConversationMemory.instance
  }

  async getConversationContext(
    conversationId: string,
    documentId: string,
    userId: string
  ): Promise<ConversationContext> {
    const cacheKey = `${conversationId}_${documentId}_${userId}`
    
    // Check cache first
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!
    }

    // Load from database via API
    const context = await this.loadConversationFromAPI(conversationId, documentId, userId)
    
    // Cache the context
    this.memoryCache.set(cacheKey, context)
    
    // Clean up cache if it gets too large
    if (this.memoryCache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(firstKey)
    }
    
    return context
  }

  async updateConversationContext(
    conversationId: string,
    documentId: string,
    userId: string,
    newMessage: BaseMessage,
    editHistoryEntry?: EditHistoryEntry
  ): Promise<void> {
    const context = await this.getConversationContext(conversationId, documentId, userId)
    
    // Add new message
    context.messages.push(newMessage)
    
    // Keep only recent messages
    if (context.messages.length > this.MAX_MESSAGE_HISTORY) {
      context.messages = context.messages.slice(-this.MAX_MESSAGE_HISTORY)
    }
    
    // Add edit history entry if provided
    if (editHistoryEntry) {
      context.editHistory.push(editHistoryEntry)
      context.lastEditRequest = editHistoryEntry.userIntent
    }
    
    // Update document version
    context.documentVersion += 1
    
    // Update cache
    const cacheKey = `${conversationId}_${documentId}_${userId}`
    this.memoryCache.set(cacheKey, context)
    
    // Persist to database via API
    await this.saveConversationToAPI(context)
  }

  async getRelevantContext(
    conversationId: string,
    documentId: string,
    userId: string,
    currentMessage: string
  ): Promise<{
    recentMessages: BaseMessage[]
    editPatterns: string[]
    documentContext: string
    userPreferences: {
      preferredEditStyle: string
      commonIntents: string[]
      guardrails: Record<string, boolean>
    }
  }> {
    const context = await this.getConversationContext(conversationId, documentId, userId)
    
    // Get recent messages (last 5)
    const recentMessages = context.messages.slice(-5)
    
    // Analyze edit patterns
    const editPatterns = this.analyzeEditPatterns(context.editHistory)
    
    // Get relevant context via API
    const relevantContext = await this.getRelevantContextFromAPI(conversationId, documentId, userId, currentMessage)
    
    const documentContext = relevantContext.documentContext
    const userPreferences = relevantContext.userPreferences
    
    return {
      recentMessages,
      editPatterns,
      documentContext,
      userPreferences
    }
  }

  private async loadConversationFromAPI(
    conversationId: string,
    documentId: string,
    userId: string
  ): Promise<ConversationContext> {
    try {
      const response = await fetch(`/api/ai/conversation-memory?conversationId=${conversationId}&documentId=${documentId}&userId=${userId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load conversation context')
      }
      
      const data = await response.json()
      return data.context
    } catch (error) {
      console.error('Error loading conversation from API:', error)
      return {
        conversationId,
        documentId,
        userId,
        messages: [],
        editHistory: [],
        documentVersion: 0
      }
    }
  }

  private async saveConversationToAPI(context: ConversationContext): Promise<void> {
    try {
      const response = await fetch('/api/ai/conversation-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: context.conversationId,
          documentId: context.documentId,
          userId: context.userId,
          newMessage: context.messages[context.messages.length - 1],
          editHistoryEntry: context.editHistory[context.editHistory.length - 1]
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save conversation context')
      }
    } catch (error) {
      console.error('Error saving conversation to API:', error)
    }
  }

  private async getRelevantContextFromAPI(
    conversationId: string,
    documentId: string,
    userId: string,
    currentMessage: string
  ): Promise<{
    recentMessages: BaseMessage[]
    editPatterns: string[]
    documentContext: string
    userPreferences: {
      preferredEditStyle: string
      commonIntents: string[]
      guardrails: Record<string, boolean>
    }
  }> {
    try {
      const response = await fetch('/api/ai/conversation-memory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          documentId,
          userId,
          currentMessage
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to get relevant context')
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error getting relevant context from API:', error)
      return {
        recentMessages: [],
        editPatterns: [],
        documentContext: '',
        userPreferences: {
          preferredEditStyle: 'surgical',
          commonIntents: [],
          guardrails: {
            preserveVoice: true,
            allowCodeEdits: true,
            allowMathEdits: true
          }
        }
      }
    }
  }

  private analyzeEditPatterns(editHistory: EditHistoryEntry[]): string[] {
    const patterns: string[] = []
    
    // Analyze common edit types
    const editTypes = editHistory.map(entry => entry.editType)
    const typeCounts = editTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Find most common edit types
    const sortedTypes = Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type)
    
    patterns.push(...sortedTypes)
    
    // Analyze success patterns
    const successRate = editHistory.filter(entry => entry.success).length / editHistory.length
    if (successRate > 0.8) {
      patterns.push('high_success_rate')
    } else if (successRate < 0.5) {
      patterns.push('low_success_rate')
    }
    
    return patterns
  }

  private analyzeUserPreferences(
    editHistory: EditHistoryEntry[],
    messages: BaseMessage[]
  ): {
    preferredEditStyle: string
    commonIntents: string[]
    guardrails: Record<string, boolean>
  } {
    // Analyze common intents from edit history
    const intents = editHistory.map(entry => entry.userIntent.toLowerCase())
    const intentCounts = intents.reduce((acc, intent) => {
      acc[intent] = (acc[intent] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const commonIntents = Object.entries(intentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([intent]) => intent)
    
    // Determine preferred edit style based on history
    let preferredEditStyle = 'surgical'
    if (editHistory.some(entry => entry.editType === 'content' && entry.changesApplied > 10)) {
      preferredEditStyle = 'comprehensive'
    } else if (editHistory.some(entry => entry.editType === 'grammar' && entry.changesApplied < 3)) {
      preferredEditStyle = 'minimal'
    }
    
    // Analyze guardrails from messages
    const guardrails: Record<string, boolean> = {
      preserveVoice: true,
      allowCodeEdits: true,
      allowMathEdits: true
    }
    
    // This would analyze message content for guardrail preferences
    // For now, using defaults
    
    return {
      preferredEditStyle,
      commonIntents,
      guardrails
    }
  }

  clearCache(): void {
    this.memoryCache.clear()
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.memoryCache.size,
      maxSize: this.MAX_CACHE_SIZE
    }
  }
}

export const conversationMemory = ConversationMemory.getInstance()
