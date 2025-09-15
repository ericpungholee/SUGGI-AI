'use client'

import React, { useState } from 'react'
import { useAIChat } from '@/hooks/useAIChat'
import { Globe } from 'lucide-react'
import MessageFormatter from '@/components/ai/MessageFormatter'

interface AIChatWithCancelProps {
  documentId?: string
  conversationId?: string
  includeContext?: boolean
  useWebSearch?: boolean
}

export default function AIChatWithCancel({ 
  documentId, 
  conversationId, 
  includeContext = true,
  useWebSearch: initialUseWebSearch = false
}: AIChatWithCancelProps) {
  const [inputMessage, setInputMessage] = useState('')
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch)
  const {
    messages,
    isLoading,
    isCancelling,
    currentOperationId,
    error,
    sendMessage,
    cancelOperation,
    clearMessages,
    clearError
  } = useAIChat({
    documentId,
    conversationId,
    includeContext,
    useWebSearch
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading) return

    const message = inputMessage.trim()
    setInputMessage('')
    await sendMessage(message)
  }

  const handleCancel = async () => {
    await cancelOperation()
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">AI Chat</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setUseWebSearch(!useWebSearch)}
            className={`p-2 rounded transition-colors ${
              useWebSearch 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={useWebSearch ? 'Web search enabled' : 'Enable web search'}
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={clearMessages}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Start a conversation with the AI
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-lg px-5 py-4 rounded-xl ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.cancelled
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.role === 'assistant' ? (
                  <MessageFormatter content={message.content} />
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                )}
                <div className="text-xs opacity-70 mt-2 pt-2 border-t border-gray-200">
                  {message.timestamp.toLocaleTimeString()}
                  {message.cancelled && ' (Cancelled)'}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg border border-red-300">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="ml-2 text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                />
              </svg>
              Send
            </button>
          )}
        </div>
      </form>

      {/* Status indicators */}
      {useWebSearch && (
        <div className="px-4 py-2 bg-blue-50 text-blue-800 text-sm flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Web search enabled - AI will search the web for current information
        </div>
      )}
      {currentOperationId && (
        <div className="px-4 py-2 bg-blue-50 text-blue-800 text-sm">
          Operation ID: {currentOperationId}
        </div>
      )}
    </div>
  )
}
