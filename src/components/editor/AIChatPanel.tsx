'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, Send, User, GripVertical, Feather, Paperclip, Loader2, Globe, Check, XCircle } from 'lucide-react'
import { PreviewOps } from '@/lib/ai/writer-agent-v2'
import { AIEditorAgent } from '@/lib/ai/editor-agent'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  width: number
  onWidthChange: (width: number) => void
  documentId?: string
  editorAgent?: AIEditorAgent // AI Editor Agent for direct manipulation
  editorRef?: React.RefObject<HTMLDivElement | null> // Editor reference for Writer Agent
  onLiveTypingChange?: (isTyping: boolean) => void // Callback for live typing state changes
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'preview' | 'approval'
  content: string
  timestamp: Date
  previewOps?: PreviewOps
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
  onWidthChange,
  documentId,
  editorAgent,
  editorRef,
  onLiveTypingChange
}: AIChatPanelProps) {
  const { data: session } = useSession()
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [connectedDocuments, setConnectedDocuments] = useState<Array<{id: string, title: string}>>([])
  const [showDocumentSelector, setShowDocumentSelector] = useState(false)
  const [availableDocuments, setAvailableDocuments] = useState<Array<{id: string, title: string}>>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [chatMode, setChatMode] = useState<'regular' | 'writer'>('regular')
  const [pendingChange, setPendingChange] = useState<PreviewOps | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [isDenying, setIsDenying] = useState(false)
  const [isLiveTyping, setIsLiveTyping] = useState(false)
  const [linkedDocuments, setLinkedDocuments] = useState<string[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  


  // Load conversation history when component mounts or documentId changes
  const loadConversationHistory = useCallback(async () => {
    if (!documentId || !session?.user?.id) return

    try {
      console.log('📚 Loading conversation history for document:', documentId)
      
      const response = await fetch(`/api/conversations?documentId=${documentId}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        
        // If it's a 500 error, try to parse the error details
        if (response.status === 500) {
          try {
            const errorData = JSON.parse(errorText)
            console.error('❌ Parsed error details:', errorData)
          } catch (parseError) {
            console.error('❌ Could not parse error response as JSON:', parseError)
          }
        }
        
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      if (data.conversationId && data.messages && data.messages.length > 0) {
        console.log('📚 Loaded conversation history:', {
          conversationId: data.conversationId,
          messageCount: data.messages.length
        })
        
        // Convert timestamp strings back to Date objects
        const messagesWithDates = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        
        setConversationId(data.conversationId)
        setMessages(messagesWithDates)
      } else {
        console.log('📚 No conversation history found')
        setConversationId(null)
        setMessages([])
      }
    } catch (error) {
      console.error('❌ Error loading conversation history:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        documentId,
        userId: session?.user?.id
      })
      setConversationId(null)
      setMessages([])
    }
  }, [documentId, session?.user?.id])

  // Save conversation history
  const saveConversationHistory = useCallback(async (messagesToSave: ChatMessage[]) => {
    if (!documentId || !session?.user?.id || messagesToSave.length === 0) return

    try {
      console.log('💾 Saving conversation history:', {
        documentId,
        messageCount: messagesToSave.length
      })
      
      const response = await fetch('/api/conversations', {
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
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.conversationId) {
        setConversationId(data.conversationId)
        console.log('✅ Conversation saved:', data.conversationId)
      }
    } catch (error) {
      console.error('❌ Error saving conversation history:', error)
    }
  }, [documentId, session?.user?.id])

  // Load available documents when component mounts or documentId changes
  useEffect(() => {
    if (documentId && isOpen) {
      loadAvailableDocuments()
      loadConversationHistory()
    }
  }, [documentId, isOpen, loadConversationHistory])

  // Debug editor agent availability
  useEffect(() => {
    console.log('🔍 AIChatPanel editor agent status:', {
      hasEditorAgent: !!editorAgent,
      hasWriteContent: typeof editorAgent?.writeContent === 'function',
      hasEditorRef: !!editorRef?.current,
      isOpen
    })
  }, [editorAgent, editorRef?.current, isOpen])


  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

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

  // Handle approval workflow - now just saves already-written content
  const handleApprove = async (pendingChangeId: string) => {
    if (isApproving) return
    
    setIsApproving(true)
    try {
      // Find the pending change
      const pendingChange = messages.find(msg => 
        msg.type === 'approval' && msg.approvalData?.pendingChangeId === pendingChangeId
      )
      
      if (!pendingChange?.previewOps) {
        throw new Error('Pending change not found')
      }
      
      console.log('🔍 Saving approved content to document:', {
        pendingChangeId,
        hasEditorAgent: !!editorAgent,
        hasEditorRef: !!editorRef?.current
      })
      
      // Content is already written to the editor, so we just need to save it
      // The editor's auto-save or manual save will handle persisting the content
      
      // Remove the approval message and update UI
      setMessages(prev => prev.filter(msg => 
        !(msg.type === 'approval' && msg.approvalData?.pendingChangeId === pendingChangeId)
      ))
      setPendingChange(null)
      
      // Add success message
      const successMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '✅ Content has been saved to your document!',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, successMessage]
        // Save conversation history after adding success message
        saveConversationHistory(newMessages)
        return newMessages
      })
    } catch (error) {
      console.error('Approval error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Failed to save content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, errorMessage]
        // Save conversation history after adding error message
        saveConversationHistory(newMessages)
        return newMessages
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleDeny = async (pendingChangeId: string) => {
    if (isDenying) return
    
    setIsDenying(true)
    try {
      // Find the pending change to get the content that was written
      const pendingChange = messages.find(msg => 
        msg.type === 'approval' && msg.approvalData?.pendingChangeId === pendingChangeId
      )
      
      if (pendingChange?.previewOps) {
        // Get the content that was written so we can remove it
        const contentToRemove = pendingChange.previewOps.ops
          .filter(op => op.op === 'insert' && op.text)
          .map(op => op.text)
          .join('\n')
        
        if (contentToRemove && editorRef?.current) {
          // Remove the content from the editor
          const currentContent = editorRef.current.innerHTML
          const newContent = currentContent.replace(contentToRemove, '').replace(/\n\n$/, '')
          editorRef.current.innerHTML = newContent
          
          // Ensure content remains editable after removal
          editorRef.current.setAttribute('contenteditable', 'true')
          const allElements = editorRef.current.querySelectorAll('*')
          allElements.forEach(element => {
            element.removeAttribute('readonly')
            element.removeAttribute('disabled')
            element.setAttribute('contenteditable', 'true')
          })
          
          // Trigger input event to notify React of the change
          const inputEvent = new Event('input', { bubbles: true })
          editorRef.current.dispatchEvent(inputEvent)
          
          console.log('✅ Content removed from editor')
        }
      }
      
      // Remove the approval message
      setMessages(prev => prev.filter(msg => 
        !(msg.type === 'approval' && msg.approvalData?.pendingChangeId === pendingChangeId)
      ))
      setPendingChange(null)
      
      // Add denial message
      const denialMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ Content removed. What would you like me to do instead?',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, denialMessage]
        // Save conversation history after adding denial message
        saveConversationHistory(newMessages)
        return newMessages
      })
    } catch (error) {
      console.error('Denial error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ Failed to remove content. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, errorMessage]
        // Save conversation history after adding error message
        saveConversationHistory(newMessages)
        return newMessages
      })
    } finally {
      setIsDenying(false)
    }
  }

  // Link a document for RAG retrieval (up to 5 documents max)
  const linkDocument = (documentId: string) => {
    if (linkedDocuments.length >= 5) {
      alert('Maximum of 5 documents can be linked for RAG retrieval.')
      return false
    }
    
    if (!linkedDocuments.includes(documentId)) {
      setLinkedDocuments(prev => [...prev, documentId])
      return true
    }
    return false
  }

  // Unlink a document
  const unlinkDocument = (documentId: string) => {
    setLinkedDocuments(prev => prev.filter(id => id !== documentId))
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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) {
      return
    }

    const message = inputValue.trim()

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }

    setMessages(prev => {
      const newMessages = [...prev, userMessage]
      // Save conversation history after adding user message
      saveConversationHistory(newMessages)
      return newMessages
    })
    setInputValue('')
    setIsLoading(true)

    try {
      // Auto-detect if this should use Writer Agent mode
      const shouldUseWriterAgent = (
        message.toLowerCase().includes('rewrite') ||
        message.toLowerCase().includes('edit') ||
        message.toLowerCase().includes('format') ||
        message.toLowerCase().includes('change') ||
        message.toLowerCase().includes('modify') ||
        message.toLowerCase().includes('improve') ||
        message.toLowerCase().includes('fix') ||
        message.toLowerCase().includes('correct') ||
        message.toLowerCase().includes('make this') ||
        message.toLowerCase().includes('turn this into') ||
        message.toLowerCase().includes('convert this') ||
        message.toLowerCase().includes('transform') ||
        message.toLowerCase().includes('restructure') ||
        message.toLowerCase().includes('reorganize') ||
        (window.getSelection() && window.getSelection()!.toString().trim().length > 0)
      )

      if (shouldUseWriterAgent) {
        // Writer Agent V2 mode
        const selection = window.getSelection()
        const selectionText = selection ? selection.toString() : ''

        console.log('🔍 Writer Agent V2: Sending request with web search:', useWebSearch)
        
        // Call the new Writer Agent V2 API
        const conversationHistory = messages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
        
        const response = await fetch('/api/writer-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAsk: message,
            selectionText,
            filePath: documentId || '',
            recentTopics: [],
            documentId,
            action: 'process',
            useWebSearch,
            conversationHistory,
            linkedDocuments
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.type === 'immediate_write') {
          const { content, previewOps, pending_change_id } = result.data
          
          // For live edit content, don't write immediately - show approval for live typing
          console.log('🔍 Live edit content detected, showing approval for live typing instead of immediate write')
          
          // Create a preview operation for live typing
          const liveEditOps: PreviewOps = {
            pending_change_id: `live_edit_${Date.now()}`,
            summary: `Add ${content.length} characters of content to the document`,
            notes: 'AI generated content for live editing',
            citations: [],
            ops: [{
              op: 'insert',
              text: content,
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
            // Save conversation history after adding approval message
            saveConversationHistory(newMessages)
            return newMessages
          })
        } else if (result.type === 'preview') {
          const previewOps = result.data as PreviewOps
          setPendingChange(previewOps)
          
          // Create approval message with action buttons
          const approvalMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'approval',
            content: result.message || previewOps.summary,
            timestamp: new Date(),
            previewOps,
            approvalData: {
              pendingChangeId: previewOps.pending_change_id,
              summary: previewOps.summary,
              sources: previewOps.citations.map((c: any) => c.url || c.anchor || 'Document').filter(Boolean),
              canApprove: true,
              canDeny: true
            }
          }
          setMessages(prev => {
            const newMessages = [...prev, approvalMessage]
            // Save conversation history after adding approval message
            saveConversationHistory(newMessages)
            return newMessages
          })
        } else {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: result.message || 'Processing completed',
            timestamp: new Date()
          }
          setMessages(prev => {
            const newMessages = [...prev, aiMessage]
            // Save conversation history after adding AI message
            saveConversationHistory(newMessages)
            return newMessages
          })
        }
      } else {
        // Regular chat mode
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
            documentId,
            connectedDocumentIds: connectedDocuments.map(doc => doc.id),
            includeContext: true,
            useWebSearch,
            conversationHistory
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        
        console.log('🔍 Chat API Response:', {
          hasLiveEditContent: !!data.liveEditContent,
          liveEditContentLength: data.liveEditContent?.length || 0,
          shouldTriggerLiveEdit: data.metadata?.shouldTriggerLiveEdit,
          message: data.message?.substring(0, 100) + '...',
          fullResponse: data
        })

        // Handle live editing - show approval/deny buttons for content to be written
        if (data.liveEditContent) {
          console.log('🔍 Live editing content detected:', {
            contentLength: data.liveEditContent.length,
            shouldTriggerLiveEdit: data.metadata?.shouldTriggerLiveEdit
          })
          
          // Create a preview operation for the content
          const previewOps: PreviewOps = {
            pending_change_id: `live_edit_${Date.now()}`,
            summary: `Add ${data.liveEditContent.length} characters of content to the document`,
            notes: 'AI generated content for live editing',
            citations: [],
            ops: [{
              op: 'insert',
              text: data.liveEditContent,
              anchor: 'end'
            }]
          }
          
          setPendingChange(previewOps)
          
          // Create approval message with action buttons
          const approvalMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'approval',
            content: data.message || 'I have prepared content to add to your document. Please review and approve or deny.',
            timestamp: new Date(),
            previewOps,
            approvalData: {
              pendingChangeId: previewOps.pending_change_id,
              summary: previewOps.summary,
              sources: ['AI Generated Content'],
              canApprove: true,
              canDeny: true
            }
          }
          setMessages(prev => {
            const newMessages = [...prev, approvalMessage]
            // Save conversation history after adding approval message
            saveConversationHistory(newMessages)
            return newMessages
          })
        } else {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.message || 'No response received',
            timestamp: new Date()
          }
          setMessages(prev => {
            const newMessages = [...prev, aiMessage]
            // Save conversation history after adding AI message
            saveConversationHistory(newMessages)
            return newMessages
          })
        }
      }

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, errorMessage]
        // Save conversation history after adding error message
        saveConversationHistory(newMessages)
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveChange = async () => {
    if (!pendingChange) return

    console.log('🔍 Approve button clicked, starting live typing:', {
      pendingChangeId: pendingChange.pending_change_id,
      opsCount: pendingChange.ops.length,
      firstOp: pendingChange.ops[0]
    })

    try {
      // Call the new Writer Agent V2 API to apply changes
      const response = await fetch('/api/writer-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'apply',
          pending_change_id: pendingChange.pending_change_id
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Apply the changes to the editor directly
        if (pendingChange && editorAgent) {
          try {
            // Apply each operation from the preview ops
            for (const op of pendingChange.ops) {
              switch (op.op) {
                case 'insert':
                  if (op.text && editorAgent) {
                    // Start live typing the content character by character
                    console.log('🤖 Starting live typing for live edit content:', { textLength: op.text.length })
                    
                    // Move cursor to end of document
                    if (editorRef && editorRef.current) {
                      const range = document.createRange()
                      const sel = window.getSelection()
                      range.selectNodeContents(editorRef.current)
                      range.collapse(false)
                      sel?.removeAllRanges()
                      sel?.addRange(range)
                    }
                    
                    // Temporarily disable live typing to test normal typing
                    try {
                      setIsLiveTyping(true)
                      onLiveTypingChange?.(true)
                      
                      // Use simple text insertion instead of live typing
                      editorAgent.appendContent(op.text)
                      console.log('✅ Content inserted (live typing disabled for testing)')
                    } catch (error) {
                      console.error('❌ Content insertion failed:', error)
                      // Fallback to instant insertion if live typing fails
                      editorAgent.appendContent(op.text)
                    } finally {
                      setIsLiveTyping(false)
                      onLiveTypingChange?.(false)
                      
                      // Ensure editor remains editable after content insertion
                      if (editorAgent) {
                        editorAgent.ensureEditable()
                      }
                      
                      // Focus the editor to ensure it's active and editable
                      if (editorRef && editorRef.current) {
                        editorRef.current.focus()
                        
                        // Ensure the editor is properly editable
                        editorRef.current.setAttribute('contenteditable', 'true')
                        editorRef.current.removeAttribute('readonly')
                        editorRef.current.removeAttribute('disabled')
                        
                        // Ensure all child elements are editable
                        const allElements = editorRef.current.querySelectorAll('*')
                        allElements.forEach(element => {
                          element.removeAttribute('readonly')
                          element.removeAttribute('disabled')
                          element.setAttribute('contenteditable', 'true')
                        })
                      }
                    }
                  } else if (op.text) {
                    console.error('❌ No editor agent available for content insertion')
                  }
                  break
                case 'insert_after':
                  if (op.anchor && op.text) {
                    // Insert text after the specified anchor
                    editorAgent.appendContent(op.text)
                  }
                  break
                case 'replace_range':
                  if (op.range && op.text) {
                    // Replace text in the specified range
                    editorAgent.selectText(op.range.start.offset, op.range.end.offset)
                    editorAgent.replaceContent(op.text, op.text)
                  }
                  break
                case 'delete_range':
                  if (op.range) {
                    // Delete text in the specified range
                    editorAgent.selectText(op.range.start.offset, op.range.end.offset)
                    editorAgent.deleteSelection()
                  }
                  break
                case 'format':
                  if (op.range && op.style) {
                    // Apply formatting to the specified range
                    editorAgent.selectText(op.range.start.offset, op.range.end.offset)
                    editorAgent.applyFormat(op.style)
                  }
                  break
                default:
                  console.log('Unsupported operation:', op.op)
              }
            }
          } catch (error) {
            console.error('Error applying editor operations:', error)
          }
        }
        
        setPendingChange(null)
        
        const successMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `✅ Applied changes: ${pendingChange.summary}`,
          timestamp: new Date()
        }
        setMessages(prev => {
        const newMessages = [...prev, successMessage]
        // Save conversation history after adding success message
        saveConversationHistory(newMessages)
        return newMessages
      })
      } else {
        throw new Error(result.message || 'Failed to apply changes')
      }
    } catch (error) {
      console.error('Error applying changes:', error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Failed to apply changes. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const newMessages = [...prev, errorMessage]
        // Save conversation history after adding error message
        saveConversationHistory(newMessages)
        return newMessages
      })
    }
  }

  const handleRejectChange = async () => {
    if (!pendingChange) return

    try {
      // Call the new Writer Agent V2 API to revert changes
      const response = await fetch('/api/writer-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revert',
          pending_change_id: pendingChange.pending_change_id
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Changes reverted:', result.message)
      }
    } catch (error) {
      console.error('Error reverting changes:', error)
    }

    setPendingChange(null)
    
    const rejectMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Changes rejected. What would you like me to do instead?',
      timestamp: new Date()
    }
    setMessages(prev => {
      const newMessages = [...prev, rejectMessage]
      // Save conversation history after adding reject message
      saveConversationHistory(newMessages)
      return newMessages
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date | string | number) => {
    try {
      // Convert to Date object if it's not already
      const dateObj = date instanceof Date ? date : new Date(date)
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date provided to formatTime:', date)
        return 'Invalid time'
      }
      
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (error) {
      console.error('Error formatting time:', error, 'Input:', date)
      return 'Invalid time'
    }
  }

  if (!isOpen) return null

  return (
    <div 
      ref={panelRef}
      className="fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out z-40"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center shadow-sm">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Suggi AI</h3>
              <p className="text-xs text-gray-600">AI writing assistant with document editing</p>
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
        
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {chatMode === 'writer' 
                ? (documentId ? 'Document editing mode' : 'Writer Agent ready')
                : (documentId ? 'Document context enabled' : 'Writing helper')
              }
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

      {/* Linked Documents for RAG */}
      {linkedDocuments.length > 0 && (
        <div className="border-b border-gray-200 bg-blue-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-blue-900">RAG Documents ({linkedDocuments.length}/5)</h4>
            <span className="text-xs text-blue-600">Current + {linkedDocuments.length} linked</span>
          </div>
          <div className="space-y-1">
            {linkedDocuments.map((docId) => {
              const doc = availableDocuments.find(d => d.id === docId)
              return (
                <div key={docId} className="flex items-center justify-between bg-white rounded px-2 py-1 text-xs">
                  <span className="text-gray-900 truncate">{doc?.title || `Document ${docId}`}</span>
                  <button
                    onClick={() => unlinkDocument(docId)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Feather className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {chatMode === 'writer' ? 'Writer Agent Ready' : 'Welcome to Suggi AI'}
              </h3>
              <p className="text-sm text-gray-600 max-w-sm">
                {chatMode === 'writer' 
                  ? 'I can help you edit your document with precision. Select text and ask me to rewrite, summarize, extend, or format it. I\'ll show you preview changes before applying them.'
                  : 'I\'m your AI writing assistant. I can help you write, edit, and improve your documents. Ask me anything or request content to be written directly into your document.'
                }
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.type === 'assistant' && (
                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Feather className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                  message.type === 'user'
                    ? 'bg-gray-900 text-white'
                    : message.type === 'preview'
                    ? 'bg-blue-50 text-blue-900 border border-blue-200'
                    : message.type === 'approval'
                    ? 'bg-green-50 text-green-900 border border-green-200'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                
                {message.type === 'preview' && message.previewOps && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-blue-800">Preview Changes:</span>
                      <span className="text-xs text-blue-600">{message.previewOps.ops.length} operations</span>
                    </div>
                    
                    {message.previewOps.citations.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-blue-700">Sources: </span>
                        {message.previewOps.citations.map((citation, index) => (
                          <span key={index} className="text-xs text-blue-600">
                            {citation.type === 'doc' ? 'Your docs' : new URL(citation.url || '').hostname}
                            {index < message.previewOps!.citations.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleApproveChange}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={handleRejectChange}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Deny
                      </button>
                    </div>
                  </div>
                )}
                
                {message.type === 'approval' && message.approvalData && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <div className="text-sm font-medium text-green-700 mb-2">
                      {message.approvalData.summary}
                    </div>
                    
                    {message.approvalData.sources.length > 0 && (
                      <div className="text-xs text-green-600 mb-3">
                        <div className="font-medium mb-1">Sources:</div>
                        <div className="space-y-1">
                          {message.approvalData.sources.map((source, index) => (
                            <div key={index} className="truncate">• {source}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(message.approvalData!.pendingChangeId)}
                        disabled={isApproving || !message.approvalData!.canApprove}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isApproving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Approve
                      </button>
                      
                      <button
                        onClick={() => handleDeny(message.approvalData!.pendingChangeId)}
                        disabled={isDenying || !message.approvalData!.canDeny}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDenying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        Deny
                      </button>
                    </div>
                  </div>
                )}
                
                <p className={`text-xs mt-2 ${
                  message.type === 'user' 
                    ? 'text-white/70' 
                    : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
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
            <div className="bg-white text-gray-900 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Live typing indicator */}
        {isLiveTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <div className="bg-green-50 text-green-900 border border-green-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm font-medium">Writing to document...</span>
              </div>
            </div>
          </div>
        )}

        {/* Test live typing button - remove this after testing */}
        {process.env.NODE_ENV === 'development' && (
          <div className="flex gap-3 justify-start">
            <button
              onClick={async () => {
                if (editorAgent) {
                  // Disabled live typing for testing
                  editorAgent.appendContent('This is a test of content insertion (live typing disabled).')
                }
              }}
              className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              Test Content Insertion
            </button>
            <button
              onClick={() => {
                if (editorRef && editorRef.current) {
                  const isEditable = editorRef.current.getAttribute('contenteditable') === 'true'
                  const hasFocus = document.activeElement === editorRef.current
                  alert(`Editor editable: ${isEditable}, Has focus: ${hasFocus}`)
                }
              }}
              className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600"
            >
              Check Editor State
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={chatMode === 'writer' ? 'Ask me to edit your document...' : 'Ask me anything or request content to be written...'}
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
          {chatMode === 'writer' 
            ? 'Press Enter to send, Shift+Enter for new line. Select text to edit specific parts.'
            : 'Press Enter to send, Shift+Enter for new line.'
          }
        </p>
        
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