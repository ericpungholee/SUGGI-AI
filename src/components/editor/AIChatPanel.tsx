'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, Bot, User, GripVertical, Feather, Paperclip, Search, FileText, Loader2, Globe, Sparkles, Check } from 'lucide-react'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  width: number
  onWidthChange: (width: number) => void
  documentId?: string
  onContentChange?: (content: string) => void
  onStartAgentTyping?: () => void
  onStopAgentTyping?: () => void
}

export default function AIChatPanel({ 
  isOpen, 
  onClose, 
  width, 
  onWidthChange,
  documentId,
  onContentChange,
  onStartAgentTyping,
  onStopAgentTyping
}: AIChatPanelProps) {
  const { data: session, status } = useSession()
  
  console.log('🔐 AIChatPanel: Session status:', { status, hasSession: !!session, userId: session?.user?.id })
  console.log('🎨 AIChatPanel: Component rendered with props:', { isOpen, documentId, width })
  
  const [messages, setMessages] = useState<Array<{id: string, type: 'user' | 'assistant', content: string, timestamp: Date, needsApproval?: boolean, pendingContent?: string}>>([
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
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)


  
  



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

  // Generate content for edit requests
  const generateEditContent = async (userMessage: string, editRequest: any) => {
    try {
      // Call the AI to generate actual content based on the edit request
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          documentId,
          editRequest
        })
      })

      if (response.ok) {
        const data = await response.json()
        let content = data.content || ''
        
        // Clean up any meta-commentary that might have slipped through
        content = content
          .replace(/^(Here's|I've|This document|I'll|Let me|I'm going to|I can|I will).*?[.!?]\s*/gmi, '')
          .replace(/^(I apologize|Sorry|Unfortunately|I'm sorry).*?[.!?]\s*/gmi, '')
          .replace(/^(I've generated|I've created|I've written|I've added).*?[.!?]\s*/gmi, '')
          .replace(/^(The content|The document|This content).*?[.!?]\s*/gmi, '')
          .replace(/^(Draft cleared|Content cleared|Document cleared).*?[.!?]\s*/gmi, '')
          .replace(/^(What would you like|Here are|Please share|If you prefer).*?[.!?]\s*/gmi, '')
          .replace(/^(I can|I will|I'll help|I'm here).*?[.!?]\s*/gmi, '')
          .trim()
        
        // Special handling for delete/clear requests
        if (userMessage.toLowerCase().includes('delete') || userMessage.toLowerCase().includes('clear')) {
          return '' // Return empty content for delete/clear requests
        }
        
        return content || ''
      } else {
        return 'Content generated successfully.'
      }
    } catch (error) {
      console.error('Error generating edit content:', error)
      return 'Content generated successfully.'
    }
  }

  // Type content directly into the editor with live typing effect
  const typeContentIntoEditor = async (content: string) => {
    try {
      // Get the editor element
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (!editorElement) {
        console.error('Editor element not found')
        return
      }

      // Start agent typing mode to prevent auto-save
      onStartAgentTyping?.()
      
      // Disable auto-save during typing
      const originalContent = editorElement.innerHTML
      
      // Focus the editor
      editorElement.focus()

      // Split content into words for typing effect
      const words = content.split(' ')
      let currentContent = ''

      // Type each word with a delay
      for (let i = 0; i < words.length; i++) {
        const word = words[i]
        currentContent += (i > 0 ? ' ' : '') + word
        
        // Update the editor content with gray styling for pending approval
        // Use a temporary approach that doesn't trigger auto-save
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = `<span class="pending-ai-content">${currentContent}</span><span class="typing-cursor">|</span>`
        
        // Replace content without triggering input events
        editorElement.innerHTML = tempDiv.innerHTML
        
        // Wait before typing the next word
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Remove the typing cursor and keep content in pending state
      editorElement.innerHTML = `<span class="pending-ai-content">${currentContent}</span>`
      
      // Store the pending content for later approval/rejection
      ;(window as any).pendingAIContent = {
        content: currentContent,
        originalContent: originalContent
      }
      
      // Show approval UI in chat
      showApprovalUI(content)

    } catch (error) {
      console.error('Error typing content into editor:', error)
      // Stop agent typing on error
      onStopAgentTyping?.()
    }
  }

  // Show approval UI in chat
  const showApprovalUI = (content: string) => {
    const approvalMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant' as const,
      content: 'I\'ve typed the content into your document. Please review and approve or reject it.',
      timestamp: new Date(),
      needsApproval: true,
      pendingContent: content
    }
    setMessages(prev => [...prev, approvalMessage])
  }

  // Handle content approval
  const handleApproveContent = async () => {
    try {
      // Get the editor element
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (!editorElement) {
        console.error('Editor element not found')
        return
      }

      // Get the pending content
      const pendingData = (window as any).pendingAIContent
      if (!pendingData) {
        console.error('No pending content found')
        return
      }

      // Remove pending styling and make content normal
      const pendingContent = editorElement.querySelector('.pending-ai-content')
      if (pendingContent) {
        const content = pendingContent.textContent || ''
        console.log('✅ Approving AI content:', content)
        
        // Convert plain text to HTML paragraphs
        const htmlContent = content.split('\n\n').map(paragraph => 
          paragraph.trim() ? `<p>${paragraph.trim()}</p>` : ''
        ).join('')
        
        editorElement.innerHTML = htmlContent
        
        // Trigger the onContentChange callback to save the content
        if (onContentChange) {
          console.log('💾 Triggering onContentChange with HTML content:', htmlContent)
          onContentChange(htmlContent)
        }
        
        // Also trigger input event to notify the editor of changes
        const inputEvent = new Event('input', { bubbles: true })
        editorElement.dispatchEvent(inputEvent)
      }

      // Clear pending content
      delete (window as any).pendingAIContent

      // Stop agent typing mode and trigger save
      onStopAgentTyping?.()

      // Remove approval UI from messages
      setMessages(prev => prev.filter(msg => !msg.needsApproval))

      // Add approved message
      const approvedMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: 'Content approved and added to your document.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, approvedMessage])

    } catch (error) {
      console.error('Error approving content:', error)
    }
  }

  // Handle content rejection
  const handleRejectContent = async () => {
    try {
      // Get the editor element
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (!editorElement) {
        console.error('Editor element not found')
        return
      }

      // Get the pending content and restore original
      const pendingData = (window as any).pendingAIContent
      if (pendingData) {
        // Restore original content
        editorElement.innerHTML = pendingData.originalContent
      } else {
        // Fallback: remove the pending content
        const pendingContent = editorElement.querySelector('.pending-ai-content')
        if (pendingContent) {
          pendingContent.remove()
        }
      }

      // Clear pending content
      delete (window as any).pendingAIContent

      // Stop agent typing mode (no save triggered)
      onStopAgentTyping?.()

      // Remove approval UI from messages
      setMessages(prev => prev.filter(msg => !msg.needsApproval))

      // Add rejected message
      const rejectedMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: 'Content rejected and removed from your document.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, rejectedMessage])

    } catch (error) {
      console.error('Error rejecting content:', error)
    }
  }

  // Handle slash commands
  const handleSlashInput = (value: string) => {
    if (value.startsWith('/')) {
      const [command, ...args] = value.slice(1).split(' ')
      if (command) {
        // Handle slash commands here if needed
        console.log('Slash command:', command, args)
        setInputValue('')
      }
    }
  }

  const handleSendMessage = async () => {
    console.log('🎯 AIChatPanel: handleSendMessage called', {
      inputValue: inputValue.trim(),
      isLoading,
      documentId,
      hasInputValue: !!inputValue.trim()
    })
    
    if (!inputValue.trim() || isLoading) {
      console.log('❌ AIChatPanel: Early return - no input or loading')
      return
    }

    const message = inputValue.trim()
    
    // Handle slash commands
    if (message.startsWith('/')) {
      handleSlashInput(message)
      return
    }

    // Add user message to chat
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Send message to AI chat API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          documentId,
          includeContext: true,
          useWebSearch
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Chat response received:', data)

      // Handle edit requests by typing content directly into the editor
      if (data.editRequest) {
        // Generate content and type it directly into the editor
        const editContent = await generateEditContent(userMessage.content, data.editRequest)
        
        // Type the content directly into the editor
        await typeContentIntoEditor(editContent)
        
        // Add a message indicating the content was added to the document
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          content: 'I\'ve added the essay to your document. You can see it being typed in the editor.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        // Regular chat response
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
          content: data.message || 'No response received',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
      }

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }


  const handleKeyPress = (e: React.KeyboardEvent) => {
    console.log('⌨️ AIChatPanel: Key pressed', { key: e.key, shiftKey: e.shiftKey })
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('⌨️ AIChatPanel: Enter pressed, calling handleSendMessage')
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
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center shadow-sm">
            <Feather className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Suggi AI</h3>
            <p className="text-xs text-gray-600">
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
                ? 'bg-gray-900 text-white' 
                : 'hover:bg-gray-100 text-gray-900'
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
            <FileText className="w-4 h-4 text-gray-900" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-900" />
          </button>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        ref={resizeRef}
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-gray-900 transition-colors group"
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="w-1 h-full bg-transparent group-hover:bg-gray-900 transition-colors" />
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-3 h-8 bg-gray-300 rounded-r opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-gray-900" />
        </div>
      </div>

      {/* Quick Actions Panel */}
      {showQuickActions && (
        <div className="border-b border-gray-200 p-4 bg-white">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.action)}
                className="text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 hover:border-gray-300 text-gray-900"
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
                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Feather className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[85%] rounded-xl px-5 py-4 shadow-sm ${
                  message.type === 'user'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                
                {/* Approval UI for pending content */}
                {message.needsApproval && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800 mb-3">Review the content in your document and decide:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleApproveContent}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={handleRejectContent}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <p className={`text-xs ${
                    message.type === 'user' 
                      ? 'text-white/70' 
                      : 'text-gray-600'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>

              {message.type === 'user' && (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className="w-4 h-4 text-gray-900" />
                </div>
              )}
            </div>
          ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white text-gray-900 border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                <span className="text-sm">
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-gray-900" />
          </button>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your document or request edits..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-gray-900"
            rows={2}
          />
            <button
              onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
            >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Press Enter to send, Shift+Enter for new line.
        </p>
        
        {/* Status indicators */}
        {useWebSearch && (
          <div className="mt-3 px-3 py-2 bg-blue-50 text-blue-800 text-sm flex items-center gap-2 rounded-lg">
            <Globe className="w-4 h-4" />
            Web search enabled
          </div>
        )}
        
      </div>
    </div>
  )
}
