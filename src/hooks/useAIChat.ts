import { useState, useCallback, useRef } from 'react'

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  cancelled?: boolean
  metadata?: {
    editSuggestion?: {
      intent: string
      shouldProposeEdit: boolean
      originalMessage: string
    }
  }
}

export interface AIChatOptions {
  documentId?: string
  conversationId?: string
  includeContext?: boolean
  useWebSearch?: boolean
}

export interface AIChatState {
  messages: AIChatMessage[]
  isLoading: boolean
  isCancelling: boolean
  currentOperationId: string | null
  error: string | null
}

export function useAIChat(options: AIChatOptions = {}) {
  const [state, setState] = useState<AIChatState>({
    messages: [],
    isLoading: false,
    isCancelling: false,
    currentOperationId: null,
    error: null
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const generateOperationId = useCallback(() => {
    return `ai-chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const sendMessage = useCallback(async (message: string) => {
    if (state.isLoading) {
      console.warn('AI chat is already processing a message')
      return
    }

    const operationId = generateOperationId()
    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      currentOperationId: operationId,
      error: null
    }))

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          documentId: options.documentId,
          conversationId: options.conversationId,
          includeContext: options.includeContext,
          useWebSearch: options.useWebSearch,
          operationId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        cancelled: data.cancelled,
        metadata: data.editSuggestion ? {
          editSuggestion: data.editSuggestion
        } : undefined
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        currentOperationId: null,
        error: null
      }))

      return data
    } catch (error) {
      console.error('Error sending message:', error)
      
      const errorMessage: AIChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'An error occurred',
        timestamp: new Date()
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
        currentOperationId: null,
        error: error instanceof Error ? error.message : 'An error occurred'
      }))
    }
  }, [state.isLoading, options.documentId, options.conversationId, options.includeContext, options.useWebSearch, generateOperationId])

  const cancelOperation = useCallback(async () => {
    if (!state.currentOperationId || state.isCancelling) {
      return
    }

    setState(prev => ({ ...prev, isCancelling: true }))

    try {
      const response = await fetch('/api/ai/chat/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationId: state.currentOperationId
        })
      })

      if (response.ok) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isCancelling: false,
          currentOperationId: null
        }))
      } else {
        console.error('Failed to cancel operation')
        setState(prev => ({ ...prev, isCancelling: false }))
      }
    } catch (error) {
      console.error('Error cancelling operation:', error)
      setState(prev => ({ ...prev, isCancelling: false }))
    }
  }, [state.currentOperationId, state.isCancelling])

  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      error: null
    }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    sendMessage,
    cancelOperation,
    clearMessages,
    clearError
  }
}
