'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, User, GripVertical, Feather, Paperclip, Loader2, Check, XCircle, Globe } from 'lucide-react'
import { AIEditorAgent } from '@/lib/ai/editor-agent'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  width: number
  documentId?: string
  onApplyChanges?: (changes: any) => void
  onRevertChanges?: () => void
  connectedDocuments?: Array<{ id: string; title: string }>
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'approval'
  content: string
  timestamp: Date
  previewOps?: any
  approvalData?: {
    pendingChangeId: string
    summary: string
    sources: string[]
    canApprove: boolean
    canDeny: boolean
  }
}

export default function AIChatPanel({ 
  isOpen, 
  onClose, 
  width, 
  documentId,
  onApplyChanges,
  onRevertChanges,
  connectedDocuments = []
}: AIChatPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingChange, setPendingChange] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [forceWebSearch, setForceWebSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load conversation history on mount
  useEffect(() => {
    if (documentId) {
      loadConversationHistory()
    }
  }, [documentId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const loadConversationHistory = async () => {
    try {
      console.log('📚 Loading conversation history for document:', documentId)
      console.log('📚 Session status:', { hasSession: !!session, userId: session?.user?.id })
      
      const response = await fetch(`/api/conversations?documentId=${documentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Ensure cookies are sent
      })
      
      console.log('📚 Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📚 Response data:', data)
        
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages || []
          setMessages(loadedMessages)
          console.log('✅ Loaded conversation history:', {
            messageCount: loadedMessages.length,
            lastMessage: loadedMessages[loadedMessages.length - 1]?.content?.substring(0, 50) + '...'
          })
        } else {
          console.log('📚 No conversation history found for document')
        }
      } else {
        const errorData = await response.json()
        console.error('Failed to load conversation history:', response.status, errorData)
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error)
    }
  }

  const saveConversationHistory = async (messagesToSave: ChatMessage[]) => {
    if (!documentId) return
    
    try {
      console.log('💾 Saving conversation history:', {
        documentId,
        messageCount: messagesToSave.length,
        hasSession: !!session,
        userId: session?.user?.id
      })
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({
          documentId,
          messages: messagesToSave
        })
      })
      
      console.log('💾 Save response status:', response.status)
      
      if (response.ok) {
        const responseData = await response.json()
        console.log('✅ Conversation history saved successfully:', responseData)
      } else {
        const errorData = await response.json()
        console.error('Failed to save conversation history:', response.status, errorData)
      }
    } catch (error) {
      console.error('Failed to save conversation history:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const message = inputValue.trim()
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Build conversation history including the current user message
      const allMessages = [...messages, userMessage]
      const conversationHistory = allMessages.slice(-10).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
      
      console.log('💬 Sending conversation history:', {
        messageCount: conversationHistory.length,
        lastMessage: conversationHistory[conversationHistory.length - 1]?.content?.substring(0, 50) + '...'
      })
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          documentId: documentId,
          conversationHistory,
          forceWebSearch
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      // Handle live edit content
      if (result.liveEditContent) {
        const liveEditOps = {
          pending_change_id: `live_edit_${Date.now()}`,
          summary: `Add ${result.liveEditContent.length} characters of content to the document`,
          notes: 'AI generated content for live editing',
          citations: [],
          ops: [{
            op: 'insert',
            text: result.liveEditContent,
            anchor: 'end'
          }]
        }
        
        setPendingChange(liveEditOps)
        
        // Create approval message for live typing
        const approvalMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'approval',
          content: result.message || 'I have prepared content to add to your document. Please review and approve or deny.',
          timestamp: new Date(),
          previewOps: liveEditOps,
          approvalData: {
            pendingChangeId: liveEditOps.pending_change_id,
            summary: liveEditOps.summary,
            sources: ['AI Generated Content'],
            canApprove: true,
            canDeny: true
          }
        }
        setMessages(prev => {
          const newMessages = [...prev, approvalMessage]
          saveConversationHistory(newMessages)
          return newMessages
        })
      } else {
        // Regular response
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: result.message || 'Processing completed',
          timestamp: new Date()
        }
        setMessages(prev => {
          const newMessages = [...prev, aiMessage]
          saveConversationHistory(newMessages)
          return newMessages
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleApprove = async () => {
    if (!pendingChange) return
    
    try {
      if (onApplyChanges) {
        onApplyChanges(pendingChange)
      }
      
      // Add confirmation message
      const confirmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Changes have been applied to the document.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, confirmMessage]
        saveConversationHistory(newMessages)
        return newMessages
      })
      
      setPendingChange(null)
      setShowPreview(false)
    } catch (error) {
      console.error('Error applying changes:', error)
    }
  }

  const handleDeny = async () => {
    if (!pendingChange) return
    
    try {
      if (onRevertChanges) {
        onRevertChanges()
      }
      
      // Add confirmation message
      const confirmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Changes have been reverted.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, confirmMessage]
        saveConversationHistory(newMessages)
        return newMessages
      })
      
      setPendingChange(null)
      setShowPreview(false)
    } catch (error) {
      console.error('Error reverting changes:', error)
    }
  }

  const clearChat = async () => {
    setMessages([])
    setPendingChange(null)
    setShowPreview(false)
    
    // Also clear the conversation history from the server
    if (documentId) {
      try {
        console.log('🗑️ Clearing conversation history for document:', documentId)
        await fetch('/api/conversations', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId
          })
        })
        console.log('✅ Conversation history cleared successfully')
      } catch (error) {
        console.error('Failed to clear conversation history:', error)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="h-full bg-white flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <Feather className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-xs text-gray-500">Powered by GPT-5 Nano</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={clearChat}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
            title="Clear chat"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Feather className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Welcome to AI Assistant</h3>
            <p className="text-sm text-gray-500">Start a conversation to get help with your document</p>
            <div className="mt-6 space-y-2">
              <div className="text-xs text-gray-400">Try asking:</div>
              <div className="space-y-1">
                <div className="text-xs bg-white rounded-lg px-3 py-2 text-gray-600 border border-gray-200">"Help me write a summary"</div>
                <div className="text-xs bg-white rounded-lg px-3 py-2 text-gray-600 border border-gray-200">"Improve this paragraph"</div>
                <div className="text-xs bg-white rounded-lg px-3 py-2 text-gray-600 border border-gray-200">"Add more details here"</div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300 w-full`}
            >
              <div
                className={`max-w-[85%] min-w-0 rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-gray-900 text-white'
                    : message.type === 'approval'
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {message.type !== 'user' && (
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3 w-3 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed break-words hyphens-auto [word-break:break-word]">
                      {message.content}
                    </div>
                    {message.type === 'approval' && message.approvalData && (
                      <div className="mt-4 space-y-3">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-xs font-medium text-gray-700 mb-1">Summary</div>
                          <div className="text-xs text-gray-600 break-words">{message.approvalData.summary}</div>
                        </div>
                        {message.approvalData.sources.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-xs font-medium text-gray-700 mb-1">Sources</div>
                            <div className="text-xs text-gray-600 break-words">{message.approvalData.sources.join(', ')}</div>
                          </div>
                        )}
                        <div className="flex space-x-2">
                          <button
                            onClick={handleApprove}
                            disabled={!message.approvalData.canApprove}
                            className="px-4 py-2 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200"
                          >
                            <Check className="h-3 w-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={handleDeny}
                            disabled={!message.approvalData.canDeny}
                            className="px-4 py-2 bg-gray-500 text-white text-xs rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200"
                          >
                            <XCircle className="h-3 w-3" />
                            <span>Deny</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300 w-full">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center space-x-3 max-w-[85%] min-w-0">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-3 w-3 text-gray-500" />
              </div>
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm text-gray-600 whitespace-nowrap">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your document..."
              className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white transition-all duration-200"
              rows={2}
              disabled={isLoading}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {inputValue.length}/500
            </div>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={() => setForceWebSearch(!forceWebSearch)}
              className={`px-3 py-3 rounded-lg flex items-center justify-center transition-all duration-200 ${
                forceWebSearch 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={forceWebSearch ? "Web search enabled - click to disable" : "Force web search - click to enable"}
            >
              <Globe className="h-4 w-4" />
            </button>
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        {forceWebSearch && (
          <div className="mt-2 text-xs text-gray-500 flex items-center space-x-1">
            <Globe className="h-3 w-3" />
            <span>Web search enabled for this query</span>
          </div>
        )}
      </div>
    </div>
  )
}
