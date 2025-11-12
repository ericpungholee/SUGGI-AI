'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, User, GripVertical, Feather, Paperclip, Loader2, Check, XCircle, Globe } from 'lucide-react'
import { getCursorContext } from '@/lib/editor/position-utils'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  width: number
  documentId?: string
  onApplyChanges?: (changes: any, cursorPosition?: string) => void
  onRevertChanges?: () => void
  connectedDocuments?: Array<{ id: string; title: string }>
  editorRef?: React.RefObject<HTMLDivElement>
  documentContent?: string
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
  connectedDocuments = [],
  editorRef,
  documentContent
}: AIChatPanelProps) {
  console.log('🔍 AIChatPanel rendered:', {
    isOpen,
    hasOnApplyChanges: !!onApplyChanges,
    hasEditorRef: !!editorRef,
    documentId,
    documentContentLength: documentContent?.length || 0
  })
  
  // Test if the component is working
  useEffect(() => {
    if (isOpen) {
      console.log('✅ AIChatPanel is open and mounted')
    }
  }, [isOpen])
  
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
    if (documentId && session?.user?.id) {
      loadConversationHistory()
    }
  }, [documentId, session?.user?.id])

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
      // Check if user is authenticated before making the request
      if (!session?.user?.id) {
        console.log('📚 No authenticated session, skipping conversation history load')
        return
      }

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
      } else if (response.status === 401) {
        console.log('📚 User not authenticated, skipping conversation history load')
      } else {
        const errorData = await response.json()
        console.error('Failed to load conversation history:', response.status, errorData)
      }
    } catch (error) {
      // Only log error if it's not a network/authentication issue
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.log('📚 Network error or user not authenticated, skipping conversation history load')
      } else {
        console.error('Failed to load conversation history:', error)
      }
    }
  }

  const saveConversationHistory = async (messagesToSave: ChatMessage[]) => {
    if (!documentId || !session?.user?.id) return
    
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

    console.log('🚀 AIChatPanel sendMessage called:', {
      messageLength: inputValue.trim().length,
      isLoading,
      hasSession: !!session?.user?.id,
      documentId,
      hasEditorRef: !!editorRef
    })

    const message = inputValue.trim()
    
    // Get current cursor context
    const cursorContext = getCursorContext(editorRef || undefined)
    
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
      // Wait for state update to complete before building conversation history
      await new Promise(resolve => setTimeout(resolve, 0))
      
      setMessages(prev => {
        const allMessages = [...prev]
        const conversationHistory = allMessages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
        
        console.log('💬 Built conversation history:', {
          totalMessages: allMessages.length,
          conversationHistoryLength: conversationHistory.length,
          historyPreview: conversationHistory.map(msg => ({
            role: msg.role,
            contentPreview: msg.content.substring(0, 50) + '...'
          }))
        })
        
        // Send the message with the conversation history
        sendMessageWithHistory(message, conversationHistory, cursorContext)
        
        return prev
      })
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  const sendMessageWithHistory = async (message: string, conversationHistory: any[], cursorContext: any) => {
    try {
      console.log('💬 Sending conversation history with context:', {
        messageCount: conversationHistory.length,
        lastMessage: conversationHistory[conversationHistory.length - 1]?.content?.substring(0, 50) + '...',
        documentContentLength: documentContent?.length || 0,
        cursorPosition: cursorContext.cursorPosition,
        selectionLength: cursorContext.selection.length,
        conversationHistoryPreview: conversationHistory.map(msg => ({
          role: msg.role,
          contentPreview: msg.content.substring(0, 50) + '...'
        }))
      })
      
      console.log('🔍 AIChatPanel making API call...')
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          documentId: documentId,
          conversationHistory,
          forceWebSearch,
          documentContent: documentContent,
          selection: cursorContext.selection,
          cursorPosition: cursorContext.cursorPosition
        })
      })

      console.log('🔍 AIChatPanel API response status:', response.status, response.ok)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('🔍 AIChatPanel raw response:', result)
      
      console.log('🔍 AIChatPanel received response:', {
        hasMessage: !!result.message,
        messageLength: result.message?.length || 0,
        shouldTriggerLiveEdit: result.metadata?.shouldTriggerLiveEdit,
        directPaste: result.metadata?.directPaste,
        intent: result.metadata?.intent,
        hasLangGraphWriterAgent: !!result.metadata?.langGraphWriterAgent,
        writerAgentTask: result.metadata?.langGraphWriterAgent?.task,
        fullResult: result
      })

      // Check if this is a writing request that should trigger approval workflow
      const shouldTriggerApproval = result.metadata?.shouldTriggerLiveEdit || result.metadata?.directPaste
      
      if (shouldTriggerApproval && result.message) {
        console.log('✍️ Writing request detected - starting approval workflow')
        
        // Step 1: Apply content to editor FIRST (will show in gray)
        if (onApplyChanges) {
          console.log('📝 Applying content to editor...', {
            hasOnApplyChanges: !!onApplyChanges,
            messageLength: result.message.length,
            cursorPosition: cursorContext.cursorPosition
          })
          onApplyChanges(result.message, cursorContext.cursorPosition)
        } else {
          console.error('❌ onApplyChanges is not available!')
        }
        
        // Step 2: Wait a moment for content to be inserted, then show approval message
        setTimeout(() => {
          let approvalContent = `Content has been added to your document. Review it and approve or deny.`
          let summary = `Generated ${result.message.length} characters`
          
          if (result.metadata?.writerAgentV2) {
            const wa2 = result.metadata.writerAgentV2
            const task = wa2.routerOut?.task || 'content generation'
            const confidence = wa2.routerOut?.confidence || 0
            const operationsCount = wa2.previewOps?.ops?.length || 0
            
            approvalContent = `Generated ${task} content (confidence: ${Math.round(confidence * 100)}%). Review and approve or deny.`
            summary = `${task} - ${operationsCount} operations, ${result.message.length} characters`
          }
          
          const approvalMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'approval',
            content: approvalContent,
            timestamp: new Date(),
            approvalData: {
              pendingChangeId: `change_${Date.now()}`,
              summary: summary,
              sources: [],
              canApprove: true,
              canDeny: true
            }
          }
          
          // Add approval message to chat
          setMessages(prev => {
            const newMessages = [...prev, approvalMessage]
            saveConversationHistory(newMessages)
            console.log('✅ Approval message added to chat:', {
              messageId: approvalMessage.id,
              type: approvalMessage.type,
              hasApprovalData: !!approvalMessage.approvalData,
              canApprove: approvalMessage.approvalData?.canApprove,
              canDeny: approvalMessage.approvalData?.canDeny
            })
            return newMessages
          })
        }, 100) // Small delay to ensure content is inserted first
        
        // Step 3: Set up the pending change for approval
        setPendingChange({
          text: result.message,
          cursorPosition: cursorContext.cursorPosition
        })
        
        setIsLoading(false)
        return
      }

      // Handle regular chat response
      if (result.message) {
        console.log('🔍 Regular chat response')
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: result.message,
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

  const handleApprove = () => {
    if (!pendingChange) return
    
    console.log('✅ Approving AI content through chat')
    console.log('🔍 Approval debug info:', {
      hasPendingChange: !!pendingChange,
      hasEditorRef: !!editorRef?.current,
      pendingChangeText: pendingChange?.text?.substring(0, 50) + '...'
    })
    
    // Use DirectEditManager's acceptProposal function
    if (editorRef?.current) {
      const directEditManager = (editorRef.current as any).directEditManager
      console.log('🔍 DirectEditManager status:', {
        hasDirectEditManager: !!directEditManager,
        hasAcceptProposal: !!directEditManager?.acceptProposal,
        managerType: typeof directEditManager
      })
      
      if (directEditManager && directEditManager.acceptProposal) {
        console.log('🚀 Calling DirectEditManager.acceptProposal()')
        directEditManager.acceptProposal()
        console.log('✅ Used DirectEditManager to approve proposal')
      } else {
        console.log('⚠️ DirectEditManager not available, using fallback')
        // Fallback: direct DOM manipulation
        const proposalElement = document.querySelector('.agent-text-block[data-is-approved="false"]') as HTMLElement
        console.log('🔍 Fallback DOM manipulation:', {
          foundProposalElement: !!proposalElement,
          elementId: proposalElement?.getAttribute('data-proposal-id')
        })
        
        if (proposalElement) {
          proposalElement.setAttribute('data-is-approved', 'true')
          proposalElement.style.cssText = `
            color: #000000 !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            transition: all 0.3s ease !important;
          `
          proposalElement.removeAttribute('data-proposal-id')
          console.log('✅ Used fallback DOM manipulation to approve proposal')
        } else {
          console.error('❌ No proposal element found for approval')
        }
      }
    } else {
      console.error('❌ No editorRef available for approval')
    }
    
    // Add confirmation message
    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Content has been approved and saved to the document.',
      timestamp: new Date()
    }
    setMessages(prev => {
      const newMessages = [...prev, confirmMessage]
      saveConversationHistory(newMessages)
      return newMessages
    })
    
    // Clear pending change
    setPendingChange(null)
    
    console.log('✅ AI content approved and saved')
  }

  const handleDeny = () => {
    if (!pendingChange) return
    
    console.log('❌ Denying AI content through chat')
    
    // Use DirectEditManager's rejectProposal function
    if (editorRef?.current) {
      const directEditManager = (editorRef.current as any).directEditManager
      if (directEditManager && directEditManager.rejectProposal) {
        directEditManager.rejectProposal()
        console.log('✅ Used DirectEditManager to reject proposal')
      } else {
        // Fallback: direct DOM manipulation
        const pendingElements = document.querySelectorAll('.agent-text-block[data-is-approved="false"]')
        pendingElements.forEach(element => {
          element.remove()
          console.log('❌ Removed pending proposal element')
        })
      }
    }
    
    // Add confirmation message
    const confirmMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Content has been removed from the document.',
      timestamp: new Date()
    }
    setMessages(prev => {
      const newMessages = [...prev, confirmMessage]
      saveConversationHistory(newMessages)
      return newMessages
    })
    
    // Clear pending change
    setPendingChange(null)
    
    console.log('✅ AI content denied and removed')
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
                {message.type === 'approval' && (
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={handleApprove}
                      className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 flex items-center space-x-2 transition-all duration-200"
                    >
                      <Check className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={handleDeny}
                      className="px-4 py-2 bg-white text-black text-sm rounded-md border border-gray-300 hover:bg-gray-100 flex items-center space-x-2 transition-all duration-200"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Deny</span>
                    </button>
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
