'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, Bot, User, GripVertical, Feather, Paperclip, Search, Loader2, Globe, Sparkles, Check } from 'lucide-react'

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
  
  const [messages, setMessages] = useState<Array<{id: string, type: 'user' | 'assistant', content: string, timestamp: Date, needsApproval?: boolean, pendingContent?: string}>>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI writing assistant. I can help you write, edit, and format your document. I can also create and edit tables, improve your writing, and answer questions about your content.\n\nTry asking me to:\n• "Create a 3x4 comparison table"\n• "Make a budget table with headers"\n• "Add a row to the table"\n• "Remove column 2 from the table"\n• "Edit cell in row 1, column 3"\n• "Delete the table"\n• "Edit this paragraph to be more concise"',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [connectedDocuments, setConnectedDocuments] = useState<Array<{id: string, title: string}>>([])
  const [showDocumentSelector, setShowDocumentSelector] = useState(false)
  const [availableDocuments, setAvailableDocuments] = useState<Array<{id: string, title: string}>>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Load chat history when component mounts or documentId changes
  useEffect(() => {
    if (documentId && isOpen) {
      loadChatHistory()
      loadAvailableDocuments()
    }
  }, [documentId, isOpen])

  // Save chat history whenever messages change (but not on initial load)
  useEffect(() => {
    if (conversationId && messages.length > 1) { // Don't save the initial welcome message
      saveChatHistory(messages)
    }
  }, [messages, conversationId])

  
  



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


  // Generate content for edit requests
  const generateEditContent = async (userMessage: string, editRequest: any) => {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
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
          editRequest,
          isMultiStepWorkflow: editRequest?.isMultiStepWorkflow || false,
          requiresWebSearch: editRequest?.requiresWebSearch || false
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

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
          .replace(/\|+/g, '') // Remove pipe characters that cause blue line artifacts
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        // Special handling for delete/clear requests
          if (userMessage.toLowerCase().includes('delete') || userMessage.toLowerCase().includes('clear') || userMessage.toLowerCase().includes('get rid of')) {
          return '' // Return empty content for delete/clear requests
        }
        
        return content || ''
      } else {
          const errorText = await response.text()
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        throw fetchError
      }
    } catch (error) {
      throw error // Re-throw to be handled by the calling function
    }
  }

  // Replace the entire editor content (for table editing)
  const replaceEditorContent = async (content: string, userMessage: string = '') => {
    try {
      // Get the editor element
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (!editorElement) {
        return
      }

      // Start agent typing mode to prevent auto-save
      onStartAgentTyping?.()

      // Store the original content to preserve existing content and images
      const originalContent = editorElement.innerHTML
      
      // Focus the editor
      editorElement.focus()

      // Check if this is a delete/clear request
      const isDeleteRequest = userMessage.toLowerCase().includes('delete') || 
                             userMessage.toLowerCase().includes('clear') || 
                             userMessage.toLowerCase().includes('get rid of')

      if (isDeleteRequest) {
        // For delete requests, clear the content but preserve the structure
        editorElement.innerHTML = '<p><br></p>'
        
        // Store the pending content for later approval/rejection
        ;(window as any).pendingAIContent = {
          content: '',
          originalContent: originalContent
        }
        
        // Show approval UI in chat
        showApprovalUI('', userMessage)
        return
      }

      // For content replacement, replace the entire content
      editorElement.innerHTML = content
      
      // Store the pending content for later approval/rejection
      ;(window as any).pendingAIContent = {
        content: content,
        originalContent: originalContent
      }
      
      // Show approval UI in chat
      showApprovalUI(content, userMessage)

    } catch (error) {
      // Stop agent typing on error
      onStopAgentTyping?.()
      
      // Final cleanup to ensure no pipe characters remain
      cleanupPipeCharacters()
    }
  }

  // Type content directly into the editor with live typing effect
  const typeContentIntoEditor = async (content: string, userMessage: string = '') => {
    try {
      // Get the editor element
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (!editorElement) {
        return
      }

      // Start agent typing mode to prevent auto-save
      onStartAgentTyping?.()

      // Store the original content to preserve existing content and images
      const originalContent = editorElement.innerHTML
      
      
      // Focus the editor
      editorElement.focus()

      // Check if this is a delete/clear request
      const isDeleteRequest = userMessage.toLowerCase().includes('delete') || 
                             userMessage.toLowerCase().includes('clear') || 
                             userMessage.toLowerCase().includes('get rid of')

      if (isDeleteRequest) {
        // For delete requests, clear the content but preserve the structure
        editorElement.innerHTML = '<p><br></p>'
        
        // Store the pending content for later approval/rejection
        ;(window as any).pendingAIContent = {
          content: '',
          originalContent: originalContent
        }
        
        // Show approval UI in chat
        showApprovalUI('', userMessage)
        return
      }

      // For content generation, append to existing content
      // Move cursor to the end of the document
      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()
        range.selectNodeContents(editorElement)
        range.collapse(false) // Collapse to end
        selection.removeAllRanges()
        selection.addRange(range)
      }

      // Split content into paragraphs first, then words within each paragraph
      const paragraphs = content.split('\n\n').filter(p => p.trim())
      let currentContent = ''

      // Type each paragraph
      for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
        const paragraph = paragraphs[pIndex].trim()
        const words = paragraph.split(' ')
        
        // Type each word in the current paragraph
        for (let wIndex = 0; wIndex < words.length; wIndex++) {
          const word = words[wIndex]
          currentContent += (wIndex > 0 ? ' ' : '') + word
          
          // Convert current content to HTML with proper paragraph formatting
          const htmlContent = currentContent.split('\n\n').map((p, index) => {
            const para = p.trim()
            if (para) {
              return `<p>${para}</p>`
            }
            return ''
          }).join('')
        
        
        // Append content to existing content with gray styling for pending approval
        const pendingContent = `<div class="pending-ai-content">${htmlContent}</div><span class="typing-cursor">|</span>`
        
        // Remove any existing typing cursor first
        const existingCursor = editorElement.querySelector('.typing-cursor')
        if (existingCursor) {
          existingCursor.remove()
        }
        
        // Remove any elements with typing class that might have CSS-generated pipe characters
        const typingElements = editorElement.querySelectorAll('.typing')
        typingElements.forEach(el => {
          el.classList.remove('typing')
        })
        
        // Replace only the pending content area, preserving existing content
        const existingPendingContent = editorElement.querySelector('.pending-ai-content')
        if (existingPendingContent) {
          // Replace existing pending content
          existingPendingContent.outerHTML = pendingContent
        } else {
          // Insert new pending content at the end
          editorElement.insertAdjacentHTML('beforeend', pendingContent)
        }
        
        // Wait before typing the next word
        await new Promise(resolve => setTimeout(resolve, 100))
      }

        // Add paragraph break after each paragraph (except the last one)
        if (pIndex < paragraphs.length - 1) {
          currentContent += '\n\n'
          
          // Update with paragraph break
          const htmlContent = currentContent.split('\n\n').map((p, index) => {
            const para = p.trim()
            if (para) {
              return `<p>${para}</p>`
            }
            return ''
          }).join('')
          
          const pendingContent = `<div class="pending-ai-content">${htmlContent}</div><span class="typing-cursor">|</span>`
          
          // Remove any existing typing cursor first
          const existingCursor = editorElement.querySelector('.typing-cursor')
          if (existingCursor) {
            existingCursor.remove()
          }
          
          // Remove any elements with typing class that might have CSS-generated pipe characters
          const typingElements = editorElement.querySelectorAll('.typing')
          typingElements.forEach(el => {
            el.classList.remove('typing')
          })
          
          // Replace only the pending content area
          const existingPendingContent = editorElement.querySelector('.pending-ai-content')
          if (existingPendingContent) {
            existingPendingContent.outerHTML = pendingContent
          } else {
            // Insert new pending content at the end
            editorElement.insertAdjacentHTML('beforeend', pendingContent)
          }
          
          // Pause between paragraphs
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      // Convert final content to HTML with proper paragraph formatting
      const finalHtmlContent = currentContent.split('\n\n').map(paragraph => {
        const para = paragraph.trim()
        if (para) {
          return `<p>${para}</p>`
        }
        return ''
      }).join('')

      // Remove the typing cursor and keep content in pending state with proper formatting
      const finalPendingContent = `<div class="pending-ai-content">${finalHtmlContent}</div>`
      
      // Remove any existing typing cursor first
      const existingCursor = editorElement.querySelector('.typing-cursor')
      if (existingCursor) {
        existingCursor.remove()
      }
      
      // Remove any elements with typing class that might have CSS-generated pipe characters
      const typingElements = editorElement.querySelectorAll('.typing')
      typingElements.forEach(el => {
        el.classList.remove('typing')
      })
      
      // Replace the pending content
      const existingPendingContent = editorElement.querySelector('.pending-ai-content')
      if (existingPendingContent) {
        existingPendingContent.outerHTML = finalPendingContent
      }
      
      // Store the pending content for later approval/rejection
      ;(window as any).pendingAIContent = {
        content: currentContent,
        originalContent: originalContent
      }
      
      
      // Show approval UI in chat
      showApprovalUI(content, userMessage)

    } catch (error) {
      // Stop agent typing on error
      onStopAgentTyping?.()
      
      // Final cleanup to ensure no pipe characters remain
      cleanupPipeCharacters()
    }
  }

  // Show approval UI in chat
  const showApprovalUI = (content: string, userMessage: string) => {
    // Determine the appropriate message based on the user's request
    const isDeleteRequest = userMessage.toLowerCase().includes('delete') || userMessage.toLowerCase().includes('clear')
    const messageContent = isDeleteRequest 
      ? 'I\'ve cleared the content from your document. Please review and approve or reject this change.'
      : 'I\'ve typed the content into your document. Please review and approve or reject it.'
    
    const approvalMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant' as const,
      content: messageContent,
      timestamp: new Date(),
      needsApproval: true,
      pendingContent: content
    }
    setMessages(prev => [...prev, approvalMessage])
  }

  // Comprehensive cleanup function to remove all pipe character sources
  const cleanupPipeCharacters = () => {
    const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
    if (!editorElement) return
    
    // 1. Remove all typing cursors
    const typingCursors = editorElement.querySelectorAll('.typing-cursor')
    typingCursors.forEach(cursor => cursor.remove())
    
    // 2. Remove typing classes that generate CSS pipe characters
    const typingElements = editorElement.querySelectorAll('.typing')
    typingElements.forEach(el => {
      el.classList.remove('typing')
    })
    
    // 3. Remove any literal pipe characters from content
    const currentContent = editorElement.innerHTML
    const cleanedContent = currentContent.replace(/\|+/g, '')
    if (currentContent !== cleanedContent) {
      editorElement.innerHTML = cleanedContent
    }
    
    // 4. Remove any agent typing indicators
    const typingIndicators = editorElement.querySelectorAll('.agent-typing-indicator')
    typingIndicators.forEach(indicator => indicator.remove())
  }

  // Save content directly to database
  const saveContentToDatabase = async (htmlContent: string) => {
    try {
      // Final cleanup: remove any pipe characters and typing classes before saving
      let cleanHtmlContent = htmlContent.replace(/\|+/g, '')
      
      // Remove any remaining typing classes that might generate CSS pipe characters
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (editorElement) {
        const typingElements = editorElement.querySelectorAll('.typing')
        typingElements.forEach(el => {
          el.classList.remove('typing')
        })
        // Update the content after removing typing classes
        cleanHtmlContent = editorElement.innerHTML.replace(/\|+/g, '')
      }
      
      const cleanPlainText = cleanHtmlContent.replace(/<[^>]*>/g, '')
      
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            html: cleanHtmlContent,
            plainText: cleanPlainText,
            wordCount: cleanPlainText.split(/\s+/).filter(Boolean).length
          },
          plainText: cleanPlainText,
          wordCount: cleanPlainText.split(/\s+/).filter(Boolean).length
        })
      })

      if (!response.ok) {
        console.error('Failed to save content to database:', response.status)
      }
    } catch (error) {
      console.error('Error saving content to database:', error)
    }
  }

  // Load chat history for this document
  const loadChatHistory = async () => {
    if (!documentId) return

    try {
      setIsLoadingHistory(true)

      const response = await fetch(`/api/ai/chat-history?documentId=${documentId}`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.messages && data.messages.length > 0) {
          // Convert stored messages to the correct format
          const loadedMessages = data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setMessages(loadedMessages)
        }
        
        setConversationId(data.conversationId)
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Save chat history for this document
  const saveChatHistory = async (messagesToSave: typeof messages) => {
    if (!documentId || !conversationId) return

    try {
      
      const response = await fetch('/api/ai/chat-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          messages: messagesToSave
        })
      })

      if (!response.ok) {
        console.error('Failed to save chat history:', response.status)
      }
    } catch (error) {
      console.error('Error saving chat history:', error)
    }
  }

  // Load available documents for selection
  const loadAvailableDocuments = async () => {
    if (!session?.user?.id) return

    try {
      setIsLoadingDocuments(true)
      const response = await fetch('/api/documents')
      
      if (response.ok) {
        const data = await response.json()
        
        // Filter out the current document and already connected documents
        const currentDocId = documentId
        const connectedDocIds = connectedDocuments.map(doc => doc.id)
        const available = data
          .filter((doc: any) => 
            doc.id !== currentDocId && 
            !connectedDocIds.includes(doc.id)
          )
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title
          }))
        
        setAvailableDocuments(available)
      } else {
        console.error('Failed to fetch documents:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading available documents:', error)
    } finally {
      setIsLoadingDocuments(false)
    }
  }

  // Connect a document to the chat
  const connectDocument = (document: {id: string, title: string}) => {
    if (connectedDocuments.length >= 3) {
      alert('You can connect up to 3 additional documents.')
      return
    }
    
    setConnectedDocuments(prev => [...prev, document])
    setAvailableDocuments(prev => prev.filter(doc => doc.id !== document.id))
  }

  // Disconnect a document from the chat
  const disconnectDocument = (documentId: string) => {
    const document = connectedDocuments.find(doc => doc.id === documentId)
    if (document) {
      setConnectedDocuments(prev => prev.filter(doc => doc.id !== documentId))
      setAvailableDocuments(prev => [...prev, document])
    }
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

      // Store the user message for determining the action
      const userMessage = (window as any).lastUserMessage || ''

      // Comprehensive cleanup to remove all pipe character sources
      cleanupPipeCharacters()

      // Remove pending styling and make content normal
      const pendingContent = editorElement.querySelector('.pending-ai-content')
      if (pendingContent) {
        // Get the HTML content directly, not textContent
        const htmlContent = pendingContent.innerHTML || ''
        
        // If the content is empty or just whitespace, use empty paragraph
        const finalHtmlContent = htmlContent.trim() || '<p><br></p>'
        
        // Replace only the pending content with the final content, preserving existing content
        pendingContent.outerHTML = finalHtmlContent
        
        // Get the complete editor content after the replacement
        let completeContent = editorElement.innerHTML
        
        // Final cleanup: remove any remaining pipe characters from the complete content
        completeContent = completeContent.replace(/\|+/g, '')
        
        // Update the editor with the cleaned content
        editorElement.innerHTML = completeContent
        
        // Trigger the onContentChange callback to save the content
        if (onContentChange) {
          onContentChange(completeContent)
        }
        
        // Also trigger input event to notify the editor of changes
        const inputEvent = new Event('input', { bubbles: true })
        editorElement.dispatchEvent(inputEvent)
        
        // Directly save the content to the database to ensure it persists
        await saveContentToDatabase(completeContent)
      }

      // Clear pending content
      delete (window as any).pendingAIContent

      // Stop agent typing mode and trigger save
      onStopAgentTyping?.()

      // Remove approval UI from messages
      setMessages(prev => prev.filter(msg => !msg.needsApproval))

      // Add approved message based on what was actually done
      const isDeleteRequest = userMessage.toLowerCase().includes('delete') || 
                             userMessage.toLowerCase().includes('clear') ||
                             pendingData.content === ''
      
      const approvedMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: isDeleteRequest ? 'Content cleared from your document.' : 'Content added to your document.',
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

      // Comprehensive cleanup to remove all pipe character sources
      cleanupPipeCharacters()

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

      // Get the original user message for context
      const originalUserMessage = (window as any).lastUserMessage || ''
      
      // Add rejected message with retry option
      const rejectedMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: 'Content rejected and removed from your document. I can try again - what would you like me to change about the content?',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, rejectedMessage])

      // Store the original request for potential retry
      ;(window as any).lastRejectedRequest = originalUserMessage

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
    if (!inputValue.trim() || isLoading) {
      return
    }

    const message = inputValue.trim()
    
    // Handle slash commands
    if (message.startsWith('/')) {
      handleSlashInput(message)
      return
    }

    // Check if this is feedback on a rejected request
    const lastRejectedRequest = (window as any).lastRejectedRequest
    const isFeedbackOnRejection = lastRejectedRequest && (
      message.toLowerCase().includes('paragraph') ||
      message.toLowerCase().includes('separate') ||
      message.toLowerCase().includes('different') ||
      message.toLowerCase().includes('change') ||
      message.toLowerCase().includes('fix') ||
      message.toLowerCase().includes('again') ||
      message.toLowerCase().includes('retry')
    )

    // Combine original request with feedback if this is feedback on rejection
    const finalMessage = isFeedbackOnRejection 
      ? `${lastRejectedRequest} (${message})`
      : message


    // Clear rejected request if this is a new request (not feedback)
    if (!isFeedbackOnRejection) {
      delete (window as any).lastRejectedRequest
    }

    // Add user message to chat
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message, // Show original message to user
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
          message: finalMessage, // Use the combined message for AI processing
          documentId,
          connectedDocumentIds: connectedDocuments.map(doc => doc.id),
          includeContext: true,
          useWebSearch
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Handle edit requests by typing content directly into the editor
      if (data.editRequest) {
        
        // Store the user message for later use in approval
        ;(window as any).lastUserMessage = userMessage.content
        
        try {
          // Generate content and type it directly into the editor
          const editContent = await generateEditContent(finalMessage, data.editRequest)
          
          // Check if this is a table editing request
          const isTableEdit = finalMessage.toLowerCase().includes('table') && 
                             (finalMessage.toLowerCase().includes('edit') || 
                              finalMessage.toLowerCase().includes('change') || 
                              finalMessage.toLowerCase().includes('modify'))
          
          if (isTableEdit) {
            // For table editing, replace the entire editor content
            await replaceEditorContent(editContent, userMessage.content)
          } else {
            // For regular editing, type content into the editor
            await typeContentIntoEditor(editContent, userMessage.content)
          }
        } catch (error) {
          
          // For delete/clear requests, try to clear the content directly
          const isDeleteRequest = finalMessage.toLowerCase().includes('delete') || 
                                 finalMessage.toLowerCase().includes('clear') || 
                                 finalMessage.toLowerCase().includes('get rid of')
          
          if (isDeleteRequest) {
            try {
              // Try to clear content directly
              await typeContentIntoEditor('', userMessage.content)
            } catch (clearError) {
              console.error('Direct clear failed:', clearError)
            }
          }
          
          // Add error message to chat
          const errorMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant' as const,
            content: (error instanceof Error && error.message?.includes('timeout')) 
              ? 'The request timed out. Please try again with a shorter request.'
              : 'Sorry, I encountered an error while processing your request. Please try again.',
          timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        }
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }


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
      <div className="border-b border-gray-200 bg-white">
        {/* Title Row */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center shadow-sm">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Suggi AI</h3>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-900" />
          </button>
        </div>
        
        {/* Status and Controls Row */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {documentId ? 'Document context enabled' : 'Writing helper'}
              {useWebSearch && ' • Web search enabled'}
              {connectedDocuments.length > 0 && ` • ${connectedDocuments.length} additional docs`}
            </p>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setShowDocumentSelector(!showDocumentSelector)
                  if (!showDocumentSelector) {
                    loadAvailableDocuments()
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Connect additional documents"
              >
                <Paperclip className="w-4 h-4 text-gray-900" />
              </button>
              <button
                onClick={() => setUseWebSearch(!useWebSearch)}
                className={`p-2 rounded-lg transition-colors ${
                  useWebSearch 
                    ? 'bg-gray-900 text-white' 
                    : 'hover:bg-gray-100 text-gray-900'
                }`}
                title={useWebSearch ? 'Web search enabled' : 'Enable web search'}
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Selector */}
      {showDocumentSelector && (
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Connect Documents</h4>
            <button
              onClick={() => setShowDocumentSelector(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Connected Documents */}
          {connectedDocuments.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-600 mb-2">Connected documents:</p>
              <div className="space-y-1">
                {connectedDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-white rounded px-2 py-1 text-xs">
                    <span className="text-gray-900 truncate">{doc.title}</span>
                    <button
                      onClick={() => disconnectDocument(doc.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Documents */}
          <div>
            <p className="text-xs text-gray-600 mb-2">
              Available documents ({availableDocuments.length}):
            </p>
            {isLoadingDocuments ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="ml-2 text-xs text-gray-500">Loading...</span>
              </div>
            ) : availableDocuments.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {availableDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => connectDocument(doc)}
                    disabled={connectedDocuments.length >= 3}
                    className="w-full text-left bg-white rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-gray-900 truncate">{doc.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500">No additional documents available</p>
              </div>
            )}
          </div>
        </div>
      )}

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


        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading chat history...</span>
            </div>
          ) : (
            messages.map((message) => (
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
                        className="px-3 py-1.5 bg-black text-white text-xs rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={handleRejectContent}
                        className="px-3 py-1.5 bg-white text-black text-xs rounded hover:bg-gray-100 transition-colors flex items-center gap-1 border border-gray-300"
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
            ))
          )}

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
