import React from 'react'
import { ChatMessage, AppliedEditInfo } from './types'
import { getCursorContext } from '../../../lib/editor/position-utils'
import { applyPatch, plainTextToHtml, htmlToPlainText } from '../../../lib/ai/patch-utils'

interface UseMessageHandlersProps {
  documentId?: string
  documentContent?: string
  editorRef?: React.RefObject<HTMLDivElement | null>
  forceWebSearch: boolean
  onContentChange?: (content: string) => void
  onApplyChanges?: (changes: any, cursorPosition?: string) => void
  generateMessageId: () => string
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setAppliedEditInfo: React.Dispatch<React.SetStateAction<AppliedEditInfo | null>>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  isUpdatingContentRef: React.MutableRefObject<boolean>
  saveConversationHistory: (messages: ChatMessage[]) => Promise<void>
}

export const useMessageHandlers = ({
  documentId,
  documentContent,
  editorRef,
  forceWebSearch,
  onContentChange,
  onApplyChanges,
  generateMessageId,
  setMessages,
  setAppliedEditInfo,
  setIsLoading,
  isUpdatingContentRef,
  saveConversationHistory
}: UseMessageHandlersProps) => {
  
  const sendMessageWithHistory = async (
    message: string,
    conversationHistory: any[],
    cursorContext: any
  ) => {
    try {
      console.log('💬 Sending conversation history with context:', {
        messageCount: conversationHistory.length,
        documentContentLength: documentContent?.length || 0,
        cursorPosition: cursorContext.cursorPosition
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
          forceWebSearch,
          documentContent: documentContent,
          selection: cursorContext.selection,
          cursorPosition: cursorContext.cursorPosition
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('🔍 AIChatPanel received response:', {
        hasMessage: !!result.message,
        shouldTriggerLiveEdit: result.metadata?.shouldTriggerLiveEdit,
        hasPatch: !!result.metadata?.patch
      })

      const hasPatch = !!result.metadata?.patch
      const shouldTriggerApproval = result.metadata?.shouldTriggerLiveEdit || result.metadata?.directPaste

      // Handle patch-based edits
      if (shouldTriggerApproval && hasPatch) {
        const originalContent = editorRef?.current?.innerHTML || documentContent || ''
        const originalPlainText = htmlToPlainText(originalContent)
        const patch = result.metadata.patch || ''
        const editId = `patch_${Date.now()}`
        
        if (editorRef?.current && patch) {
          isUpdatingContentRef.current = true
          
          const patchedPlainText = applyPatch(originalPlainText, patch)
          const patchedHtml = plainTextToHtml(patchedPlainText)
          
          editorRef.current.innerHTML = patchedHtml
          
          const inputEvent = new Event('input', { bubbles: true })
          editorRef.current.dispatchEvent(inputEvent)
          
          setAppliedEditInfo({
            originalContent: originalContent,
            editId: editId,
            patch: patch
          })
          
          setTimeout(() => {
            isUpdatingContentRef.current = false
          }, 200)
        }
        
        setTimeout(() => {
          const intent = result.metadata.intent || 'WRITE_INLINE'
          let approvalContent = `I've applied a ${intent === 'WRITE_INLINE' ? 'minimal edit' : intent === 'WRITE_LONGFORM' ? 'long-form writing' : 'multi-step change'}. Review and approve or deny.`
          
          let summary = 'Document edit'
          if (result.metadata?.langGraphWriterAgent) {
            const wa = result.metadata.langGraphWriterAgent
            const task = wa.task || 'content generation'
            summary = `${task} - patch-based edit`
          }
          
          const approvalMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'approval',
            content: approvalContent,
            timestamp: new Date(),
            approvalData: {
              pendingChangeId: editId,
              summary: summary,
              sources: result.metadata?.langGraphWriterAgent?.sources?.map((s: any) => s.documentTitle || s.title || 'Source') || [],
              canApprove: true,
              canDeny: true,
              patch: patch,
              oldContent: originalPlainText,
              newContent: result.metadata.newContent
            }
          }
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            let finalId = approvalMessage.id
            while (existingIds.has(finalId)) {
              finalId = generateMessageId()
            }
            const newApprovalMessage = { ...approvalMessage, id: finalId }
            const newMessages = [...prev, newApprovalMessage]
            saveConversationHistory(newMessages)
            return newMessages
          })
        }, 100)
        
        setIsLoading(false)
        return
      }
      
      // Handle writing requests without patches
      if (shouldTriggerApproval && result.message !== undefined) {
        const originalContent = editorRef?.current?.innerHTML || documentContent || ''
        const contentToApply = result.message || ''
        const cursorPos = cursorContext.cursorPosition
        const editId = `change_${Date.now()}`
        
        if (editorRef?.current) {
          isUpdatingContentRef.current = true
          
          const contentHtml = contentToApply.includes('<') ? contentToApply : plainTextToHtml(contentToApply)
          
          if (cursorPos === 'end') {
            editorRef.current.innerHTML = editorRef.current.innerHTML + contentHtml
          } else if (cursorPos === 'beginning') {
            editorRef.current.innerHTML = contentHtml + editorRef.current.innerHTML
          } else {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              if (cursorPos === 'selection') {
                range.deleteContents()
              }
              const tempDiv = document.createElement('div')
              tempDiv.innerHTML = contentHtml
              const fragment = document.createDocumentFragment()
              while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild)
              }
              range.insertNode(fragment)
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
            } else {
              editorRef.current.innerHTML = editorRef.current.innerHTML + contentHtml
            }
          }
          
          const inputEvent = new Event('input', { bubbles: true })
          editorRef.current.dispatchEvent(inputEvent)
          
          setAppliedEditInfo({
            originalContent: originalContent,
            editId: editId
          })
          
          setTimeout(() => {
            isUpdatingContentRef.current = false
          }, 200)
        }
        
        setTimeout(() => {
          let approvalContent = `I've applied content to your document. Review and approve or deny.`
          const messageLength = result.message?.length || 0
          let summary = `Generated ${messageLength} characters`
          
          if (result.metadata?.langGraphWriterAgent) {
            const wa = result.metadata.langGraphWriterAgent
            const task = wa.task || 'content generation'
            const confidence = wa.confidence || 0
            const operationsCount = wa.previewOps?.length || 0
            
            approvalContent = `I've applied ${task} content (confidence: ${Math.round(confidence * 100)}%). Review and approve or deny.`
            summary = `${task} - ${operationsCount} operations, ${messageLength} characters`
          }
          
          const approvalMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'approval',
            content: approvalContent,
            timestamp: new Date(),
            approvalData: {
              pendingChangeId: editId,
              summary: summary,
              sources: result.metadata?.langGraphWriterAgent?.sources?.map((s: any) => s.documentTitle || s.title || 'Source') || [],
              canApprove: true,
              canDeny: true,
              newContent: contentToApply,
              cursorPosition: cursorPos
            }
          }
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            let finalId = approvalMessage.id
            while (existingIds.has(finalId)) {
              finalId = generateMessageId()
            }
            const newApprovalMessage = { ...approvalMessage, id: finalId }
            const newMessages = [...prev, newApprovalMessage]
            saveConversationHistory(newMessages)
            return newMessages
          })
        }, 100)
        
        setIsLoading(false)
        return
      }

      // Handle regular chat response
      if (result.message && !hasPatch && !shouldTriggerApproval) {
        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          type: 'assistant',
          content: result.message,
          timestamp: new Date()
        }
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          let finalId = aiMessage.id
          while (existingIds.has(finalId)) {
            finalId = generateMessageId()
          }
          const newAiMessage = { ...aiMessage, id: finalId }
          const newMessages = [...prev, newAiMessage]
          saveConversationHistory(newMessages)
          return newMessages
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (
    inputValue: string,
    setInputValue: React.Dispatch<React.SetStateAction<string>>,
    addMessage: (message: ChatMessage) => void
  ) => {
    if (!inputValue.trim()) return

    const message = inputValue.trim()
    const cursorContext = getCursorContext(editorRef || undefined)
    
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }
    addMessage(userMessage)
    setInputValue('')
    setIsLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 0))
      
      setMessages(prev => {
        const allMessages = [...prev]
        const conversationHistory = allMessages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
        
        sendMessageWithHistory(message, conversationHistory, cursorContext)
        
        return prev
      })
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      addMessage(errorMessage)
      setIsLoading(false)
    }
  }

  const handleApprove = (
    messages: ChatMessage[],
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setAppliedEditInfo: React.Dispatch<React.SetStateAction<AppliedEditInfo | null>>,
    saveConversationHistory: (messages: ChatMessage[]) => Promise<void>
  ) => {
    console.log('✅ Approving AI content through chat (edit already applied)')
    
    const approvalMessage = messages
      .filter(m => m.type === 'approval')
      .slice(-1)[0]
    
    if (approvalMessage?.approvalData?.patch) {
      if (editorRef?.current) {
        const currentContent = editorRef.current.innerHTML
        
        setTimeout(() => {
          if (onContentChange) {
            onContentChange(currentContent)
          } else if (onApplyChanges) {
            onApplyChanges(currentContent, 'end')
          }
        }, 100)
      }
      
      setAppliedEditInfo(null)
      
      const confirmMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: 'Edit has been approved and saved.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        let finalId = confirmMessage.id
        while (existingIds.has(finalId)) {
          finalId = generateMessageId()
        }
        const newConfirmMessage = { ...confirmMessage, id: finalId }
        const newMessages = [...prev, newConfirmMessage]
        saveConversationHistory(newMessages)
        return newMessages
      })
      
      return
    }
    
    const nonPatchApprovalMessage = messages
      .filter(m => m.type === 'approval' && m.approvalData?.newContent && !m.approvalData?.patch)
      .slice(-1)[0]
    
    if (nonPatchApprovalMessage?.approvalData?.newContent) {
      if (editorRef?.current) {
        const currentContent = editorRef.current.innerHTML
        
        setTimeout(() => {
          if (onContentChange) {
            onContentChange(currentContent)
          } else if (onApplyChanges) {
            onApplyChanges(currentContent, 'end')
          }
        }, 100)
      }
      
      setAppliedEditInfo(null)
      
      const confirmMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: 'Edit has been approved and saved.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        let finalId = confirmMessage.id
        while (existingIds.has(finalId)) {
          finalId = generateMessageId()
        }
        const newConfirmMessage = { ...confirmMessage, id: finalId }
        const newMessages = [...prev, newConfirmMessage]
        saveConversationHistory(newMessages)
        return newMessages
      })
      
      return
    }
    
    console.warn('⚠️ No matching approval message found for approve action')
  }

  const handleDeny = (
    messages: ChatMessage[],
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    appliedEditInfo: AppliedEditInfo | null,
    setAppliedEditInfo: React.Dispatch<React.SetStateAction<AppliedEditInfo | null>>,
    isUpdatingContentRef: React.MutableRefObject<boolean>,
    saveConversationHistory: (messages: ChatMessage[]) => Promise<void>
  ) => {
    console.log('❌ Denying AI content through chat - reverting edit')
    
    if (appliedEditInfo) {
      console.log('❌ Denying edit - reverting to original content')
      
      if (editorRef?.current) {
        isUpdatingContentRef.current = true
        editorRef.current.innerHTML = appliedEditInfo.originalContent
        
        const inputEvent = new Event('input', { bubbles: true })
        editorRef.current.dispatchEvent(inputEvent)
        
        setTimeout(() => {
          isUpdatingContentRef.current = false
        }, 200)
      }
      
      setTimeout(() => {
        if (onContentChange) {
          onContentChange(appliedEditInfo.originalContent)
        } else if (onApplyChanges) {
          onApplyChanges(appliedEditInfo.originalContent, 'end')
        }
      }, 250)
      
      setAppliedEditInfo(null)
      
      const confirmMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: 'Edit has been denied. Original content has been restored.',
        timestamp: new Date()
      }
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        let finalId = confirmMessage.id
        while (existingIds.has(finalId)) {
          finalId = generateMessageId()
        }
        const newConfirmMessage = { ...confirmMessage, id: finalId }
        const newMessages = [...prev, newConfirmMessage]
        saveConversationHistory(newMessages)
        return newMessages
      })
      
      console.log('✅ Edit denied and reverted')
      return
    }
    
    console.warn('⚠️ No applied edit info found for deny action')
  }

  return {
    sendMessage,
    handleApprove,
    handleDeny
  }
}

