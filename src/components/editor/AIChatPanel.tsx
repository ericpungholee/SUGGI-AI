'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, GripVertical, Feather, Paperclip, Search, FileText, Loader2, Globe, Sparkles, Check } from 'lucide-react'
import { AIMessage, AIConversation, EditRequest } from '@/types'
import MessageFormatter from '@/components/ai/MessageFormatter'
import ChatCards from '@/components/ai/ChatCards'
import EditWorkflowCards from '@/components/ai/EditWorkflowCards'
import { useEditWorkflow } from '@/hooks/useEditWorkflow'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  width: number
  onWidthChange: (width: number) => void
  documentId?: string
  onContentChange?: (content: string) => void
}

export default function AIChatPanel({ 
  isOpen, 
  onClose, 
  width, 
  onWidthChange,
  documentId,
  onContentChange
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI writing assistant. How can I help you with your document today?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Edit workflow
  const editWorkflow = useEditWorkflow({
    documentId: documentId || '',
    onContentChange
  })


  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      const minWidth = 300
      const maxWidth = 600
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth)
      onWidthChange(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onWidthChange])

  // Helper function to detect editing requests
  const isEditingRequest = (message: string): boolean => {
    const editingKeywords = [
      'edit', 'improve', 'fix', 'change', 'revise', 'rewrite', 'enhance',
      'grammar', 'clarity', 'tone', 'structure', 'concise', 'expand',
      'tighten', 'professional', 'better', 'polish'
    ]
    
    const lowerMessage = message.toLowerCase()
    return editingKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  // Helper function to extract editing intent
  const extractEditingIntent = (message: string): string => {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('grammar')) return 'fix grammar'
    if (lowerMessage.includes('clarity')) return 'improve clarity'
    if (lowerMessage.includes('tone')) return 'enhance tone'
    if (lowerMessage.includes('structure')) return 'improve structure'
    if (lowerMessage.includes('concise') || lowerMessage.includes('tighten')) return 'make more concise'
    if (lowerMessage.includes('expand')) return 'expand content'
    if (lowerMessage.includes('professional')) return 'make tone professional'
    if (lowerMessage.includes('polish')) return 'polish writing'
    
    return 'improve writing'
  }

  // Handle slash commands
  const handleSlashInput = (value: string) => {
    if (value.startsWith('/')) {
      const [command, ...args] = value.slice(1).split(' ')
      if (command) {
        handleSlashCommand(command, args)
        setInputValue('')
      }
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const message = inputValue.trim()
    
    // Check if it's an editing request
    if (isEditingRequest(message)) {
      // Extract intent from message
      const intent = extractEditingIntent(message)
      const scope = 'document' // For now, default to document scope
      
      // Start the edit workflow
      editWorkflow.startEditWorkflow({
        documentId: documentId || '',
        scope: scope as 'document' | 'selection',
        userIntent: intent,
        selection: null,
        guardrails: {
          allowCodeChanges: false,
          allowMathChanges: false,
          preserveVoice: true
        }
      })
      setInputValue('')
      return
    }

    // Handle slash commands
    if (message.startsWith('/')) {
      handleSlashInput(message)
      return
    }

    // Regular chat message
    const operationId = `ai-chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setCurrentOperationId(operationId)

    try {
      console.log('Sending chat request:', {
        message: userMessage.content,
        documentId,
        conversationId,
        includeContext: true,
        useWebSearch,
        operationId
      })
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          documentId,
          conversationId,
          includeContext: true,
          useWebSearch,
          operationId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      console.log('AI response:', data)
      console.log('Response has editRequest:', !!data.editRequest)
      
      const aiMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.message,
        timestamp: new Date(),
        metadata: {
          documentId,
          contextUsed: data.contextUsed,
          tokenUsage: data.tokenUsage,
          cancelled: data.cancelled,
          editSuggestion: data.editSuggestion,
          editRequest: data.editRequest,
          toolCalls: data.toolCalls
        }
      }

      setMessages(prev => [...prev, aiMessage])
      setConversationId(data.conversationId)

      // If there's an edit request, start the edit workflow
      if (data.editRequest && documentId) {
        console.log('Edit request detected, starting workflow:', data.editRequest)
        const editRequest: EditRequest = {
          documentId,
          scope: data.editRequest.scope,
          userIntent: data.editRequest.intent,
          guardrails: data.editRequest.guardrails
        }
        console.log('Calling startEditWorkflow with:', editRequest)
        editWorkflow.startEditWorkflow(editRequest)
      } else {
        console.log('No edit request or documentId:', { editRequest: data.editRequest, documentId })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setIsCancelling(false)
      setCurrentOperationId(null)
    }
  }

  const handleCancelOperation = async () => {
    if (!currentOperationId || isCancelling) return

    setIsCancelling(true)

    try {
      const response = await fetch('/api/ai/chat/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationId: currentOperationId
        })
      })

      if (response.ok) {
        setIsLoading(false)
        setCurrentOperationId(null)
      } else {
        console.error('Failed to cancel operation')
      }
    } catch (error) {
      console.error('Error cancelling operation:', error)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleQuickAction = (action: string) => {
    setInputValue(action)
    setShowQuickActions(false)
  }

  const quickActions = [
    { label: 'Improve writing', action: 'Please improve the writing quality and style of this text.' },
    { label: 'Summarize', action: 'Please provide a concise summary of this content.' },
    { label: 'Expand ideas', action: 'Please expand on these ideas with more detail and examples.' },
    { label: 'Fix grammar', action: 'Please check and fix any grammar or spelling errors.' },
    { label: 'Research topic', action: 'Please help me research this topic and provide relevant information.' },
    { label: 'Generate outline', action: 'Please create a structured outline for this content.' }
  ]

  if (!isOpen) return null

  return (
    <div 
      ref={panelRef}
      className="fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out z-40"
      style={{ 
        width: `${width}px`,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center shadow-sm">
            <Feather className="w-4 h-4 text-paper" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Suggi AI</h3>
            <p className="text-xs text-ink/70">
              {documentId ? 'Document context enabled' : 'Writing helper'}
              {useWebSearch && ' • Web search enabled'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseWebSearch(!useWebSearch)}
            className={`p-1.5 rounded transition-colors ${
              useWebSearch 
                ? 'bg-ink text-paper' 
                : 'hover:bg-gray-100 text-ink'
            }`}
            title={useWebSearch ? 'Web search enabled' : 'Enable web search'}
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Quick Actions"
          >
            <FileText className="w-4 h-4 text-ink" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-ink" />
          </button>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        ref={resizeRef}
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-ink transition-colors group"
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="w-1 h-full bg-transparent group-hover:bg-ink transition-colors" />
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-3 h-8 bg-gray-300 rounded-r opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-ink" />
        </div>
      </div>

      {/* Quick Actions Panel */}
      {showQuickActions && (
        <div className="border-b border-gray-200 p-4 bg-white">
          <h4 className="text-sm font-medium text-ink mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.action)}
                className="text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 hover:border-gray-300 text-ink"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-in slide-in-from-bottom-2 duration-300 ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.type === 'assistant' && (
              <div className="w-8 h-8 bg-ink rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <Feather className="w-4 h-4 text-paper" />
              </div>
            )}
            
            <div
              className={`max-w-[85%] rounded-xl px-5 py-4 shadow-sm ${
                message.type === 'user'
                  ? 'bg-ink text-paper'
                  : message.metadata?.cancelled
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  : 'bg-white text-ink border border-gray-200'
              }`}
            >
              {message.type === 'assistant' ? (
                <MessageFormatter content={message.content} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <p className={`text-xs ${
                  message.type === 'user' 
                    ? 'text-paper/70' 
                    : message.metadata?.cancelled
                    ? 'text-yellow-700'
                    : 'text-ink/70'
                }`}>
                  {formatTime(message.timestamp)}
                  {message.metadata?.cancelled && ' (Cancelled)'}
                </p>
              </div>
            </div>

            {message.type === 'user' && (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <User className="w-4 h-4 text-ink" />
              </div>
            )}
          </div>
        ))}

        {/* Edit Workflow Cards */}
        {console.log('Edit workflow state:', editWorkflow.state, 'proposal:', editWorkflow.proposal)}
        {editWorkflow.state !== 'idle' && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-ink rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <Feather className="w-4 h-4 text-paper" />
            </div>
            <div className="bg-white text-ink border border-gray-200 rounded-lg px-4 py-2 shadow-sm max-w-[85%]">
              <EditWorkflowCards
                state={editWorkflow.state}
                proposal={editWorkflow.proposal}
                onAcceptAll={editWorkflow.acceptAll}
                onRejectAll={editWorkflow.rejectAll}
                onApplySelected={editWorkflow.applySelected}
                onDiscard={editWorkflow.discard}
                onUndo={editWorkflow.undo}
                conflicts={editWorkflow.conflicts}
              />
            </div>
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-ink rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <Feather className="w-4 h-4 text-paper" />
            </div>
            <div className="bg-white text-ink border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-ink" />
                <span className="text-sm">
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        )}

        
        <div ref={messagesEndRef} />
      </div>


      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-ink" />
          </button>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your document or request edits..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all text-ink"
            rows={2}
          />
          {isLoading ? (
            <button
              onClick={handleCancelOperation}
              disabled={isCancelling}
              className="px-4 py-2 bg-ink text-paper rounded-lg hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="px-4 py-2 bg-ink text-paper rounded-lg hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-ink/70 mt-2">
          Press Enter to send, Shift+Enter for new line. Use /edit to start editing workflow.
        </p>
        
        {/* Status indicators */}
        {useWebSearch && (
          <div className="mt-3 px-3 py-2 bg-green-50 text-green-800 text-sm flex items-center gap-2 rounded-lg">
            <Globe className="w-4 h-4" />
            Web search enabled
          </div>
        )}
        
      </div>
    </div>
  )
}
