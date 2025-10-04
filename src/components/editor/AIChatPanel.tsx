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
      
      // Handle one-shot compose approval card
      if (result.approval?.draft && result.approval?.markdown) {
        const approvalMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'approval',
          content: result.message || 'Draft ready. Review sources and approve to insert.',
          timestamp: new Date(),
          approvalData: {
            pendingChangeId: `draft_${Date.now()}`,
            summary: result.approval.summary || 'AI draft prepared',
            sources: (result.approval.sources || []).map((s: any) => s.url || s.title || s.docId),
            canApprove: true,
            canDeny: true
          },
          previewOps: {
            pending_change_id: `draft_${Date.now()}`,
            summary: 'Insert AI draft markdown into the editor',
            notes: 'AI generated draft with citations',
            citations: (result.approval.sources || []).map((s: any) => s.url || s.title || s.docId),
            ops: [{ op: 'insert', text: result.approval.markdown, anchor: 'end' }]
          }
        }
        setPendingChange(approvalMessage.previewOps)
        setMessages(prev => {
          const newMessages = [...prev, approvalMessage]
          saveConversationHistory(newMessages)
          return newMessages
        })
        setIsLoading(false)
        return
      }

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
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-gray-900 rounded-md flex items-center justify-center">
            <Feather className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={clearChat}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-200"
            title="Clear chat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Feather className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Welcome to AI Assistant</h3>
            <p className="text-xs text-gray-500">Start a conversation to get help with your document</p>
            <div className="mt-4 space-y-1">
              <div className="text-xs text-gray-400">Try asking:</div>
              <div className="space-y-1">
                <div className="text-xs bg-white rounded-md px-2 py-1.5 text-gray-600 border border-gray-200">"Help me write a summary"</div>
                <div className="text-xs bg-white rounded-md px-2 py-1.5 text-gray-600 border border-gray-200">"Improve this paragraph"</div>
                <div className="text-xs bg-white rounded-md px-2 py-1.5 text-gray-600 border border-gray-200">"Add more details here"</div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="animate-in slide-in-from-bottom-2 duration-300 w-full"
            >
              <div
                className={`w-full rounded-lg px-3 py-2.5 ${
                  message.type === 'user'
                    ? 'bg-gray-900 text-white'
                    : message.type === 'approval'
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    : 'bg-white text-gray-900'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap leading-relaxed break-words hyphens-auto [word-break:break-word]">
                  {message.content}
                </div>
                {message.type === 'approval' && message.approvalData && (
                  <div className="mt-3 space-y-2">
                    <div className="bg-white rounded-md p-2 border border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-1">Summary</div>
                      <div className="text-xs text-gray-600 break-words">{message.approvalData.summary}</div>
                    </div>
                    {message.approvalData.sources.length > 0 && (
                      <div className="bg-white rounded-md p-2 border border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-1">Sources</div>
                        <div className="text-xs text-gray-600 break-words">{message.approvalData.sources.join(', ')}</div>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <button
                        onClick={handleApprove}
                        disabled={!message.approvalData.canApprove}
                        className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-all duration-200"
                      >
                        <Check className="h-2.5 w-2.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={handleDeny}
                        disabled={!message.approvalData.canDeny}
                        className="px-3 py-1.5 bg-gray-500 text-white text-xs rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-all duration-200"
                      >
                        <XCircle className="h-2.5 w-2.5" />
                        <span>Deny</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="animate-in slide-in-from-bottom-2 duration-300 w-full">
            <div className="w-full bg-gray-100 rounded-lg px-3 py-2.5 flex items-center space-x-2">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm text-gray-700 whitespace-nowrap">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your document..."
              className="w-full resize-none border border-gray-300 rounded-md px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white transition-all duration-200"
              rows={4}
              disabled={isLoading}
            />
          <div className="absolute top-2 right-2 flex items-center space-x-1">
            <button
              onClick={() => setForceWebSearch(!forceWebSearch)}
              className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 ${
                forceWebSearch 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={forceWebSearch ? "Web search enabled - click to disable" : "Force web search - click to enable"}
            >
              <Globe className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="w-6 h-6 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
            >
              <Send className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
        {forceWebSearch && (
          <div className="mt-1.5 text-xs text-gray-500 flex items-center space-x-1">
            <Globe className="h-3 w-3" />
            <span>Web search enabled - will get real-time data and generate content directly</span>
          </div>
        )}
      </div>
    </div>
  )
}
