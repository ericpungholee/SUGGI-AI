'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, User, GripVertical, Feather, Paperclip, Loader2, Globe, Check, XCircle } from 'lucide-react'
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
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [pendingChange, setPendingChange] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
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
      const response = await fetch(`/api/conversations?documentId=${documentId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.conversations && data.conversations.length > 0) {
          const latestConversation = data.conversations[0]
          setMessages(latestConversation.messages || [])
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error)
    }
  }

  const saveConversationHistory = async (messagesToSave: ChatMessage[]) => {
    if (!documentId) return
    
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          messages: messagesToSave
        })
      })
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
      // Use the new hybrid router system via chat API
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          documentId: documentId,
          useWebSearch: useWebSearch,
          conversationHistory
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

  const clearChat = () => {
    setMessages([])
    setPendingChange(null)
    setShowPreview(false)
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-lg flex flex-col z-50"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <Feather className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear chat"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Feather className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Start a conversation with the AI assistant</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'approval'
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.type !== 'user' && (
                    <User className="h-4 w-4 mt-0.5 text-gray-500" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.type === 'approval' && message.approvalData && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs text-yellow-700">
                          <strong>Summary:</strong> {message.approvalData.summary}
                        </div>
                        {message.approvalData.sources.length > 0 && (
                          <div className="text-xs text-yellow-700">
                            <strong>Sources:</strong> {message.approvalData.sources.join(', ')}
                          </div>
                        )}
                        <div className="flex space-x-2">
                          <button
                            onClick={handleApprove}
                            disabled={!message.approvalData.canApprove}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                          >
                            <Check className="h-3 w-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={handleDeny}
                            disabled={!message.approvalData.canDeny}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
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
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-gray-600">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2 mb-2">
          <button
            onClick={() => setUseWebSearch(!useWebSearch)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
              useWebSearch
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            <Globe className="h-3 w-3" />
            <span>Web Search</span>
          </button>
        </div>
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
