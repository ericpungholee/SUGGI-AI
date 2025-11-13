'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

import { AIChatPanelProps, ChatMessage, AppliedEditInfo } from './chat/types'
import { useConversationHistory } from './chat/useConversationHistory'
import { useMessageHandlers } from './chat/useMessageHandlers'
import { ChatHeader } from './chat/ChatHeader'
import { ChatMessagesList } from './chat/ChatMessagesList'
import { ChatInput } from './chat/ChatInput'

export default function AIChatPanel({ 
  isOpen, 
  onClose, 
  width, 
  documentId,
  onApplyChanges,
  editorRef,
  documentContent,
  agentEditManager,
  onContentChange
}: AIChatPanelProps) {
  console.log('🔍 AIChatPanel rendered:', {
    isOpen,
    hasOnApplyChanges: !!onApplyChanges,
    hasEditorRef: !!editorRef,
    documentId,
    documentContentLength: documentContent?.length || 0
  })
  
  useEffect(() => {
    if (isOpen) {
      console.log('✅ AIChatPanel is open and mounted')
    }
  }, [isOpen])
  
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forceWebSearch, setForceWebSearch] = useState(false)
  const [appliedEditInfo, setAppliedEditInfo] = useState<AppliedEditInfo | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const messageIdCounter = useRef(0)
  const isUpdatingContentRef = useRef(false)

  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1
    const timestamp = Date.now()
    const performanceTime = typeof performance !== 'undefined' ? performance.now() : 0
    const random = Math.random().toString(36).substring(2, 11)
    return `msg-${timestamp}-${performanceTime}-${messageIdCounter.current}-${random}`
  }, [])

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id))
      let messageId = message.id
      
      if (!messageId || existingIds.has(messageId)) {
        messageId = generateMessageId()
      }
      
      return [...prev, { ...message, id: messageId }]
    })
  }, [generateMessageId])

  const userId = (session?.user as { id?: string })?.id

  const {
    loadConversationHistory,
    saveConversationHistory,
    clearConversationHistory
  } = useConversationHistory(documentId, userId, generateMessageId)

  useEffect(() => {
    if (documentId && userId) {
      loadConversationHistory(setMessages)
    }
  }, [documentId, userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const {
    sendMessage: handleSendMessage,
    handleApprove,
    handleDeny
  } = useMessageHandlers({
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
  })

  const sendMessage = () => {
    handleSendMessage(inputValue, setInputValue, addMessage)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const onApprove = () => {
    handleApprove(messages, setMessages, setAppliedEditInfo, saveConversationHistory)
  }

  const onDeny = () => {
    handleDeny(
      messages,
      setMessages,
      appliedEditInfo,
      setAppliedEditInfo,
      isUpdatingContentRef,
      saveConversationHistory
    )
  }

  const clearChat = async () => {
    setMessages([])
    setAppliedEditInfo(null)
    await clearConversationHistory()
  }

  if (!isOpen) return null

  return (
    <div 
      className="h-full bg-white flex flex-col"
      style={{ width: `${width}px` }}
    >
      <ChatHeader onClose={onClose} onClear={clearChat} />
      <ChatMessagesList
        messages={messages}
        isLoading={isLoading}
        onApprove={onApprove}
        onDeny={onDeny}
        messagesEndRef={messagesEndRef as any}
      />
      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={sendMessage}
        isLoading={isLoading}
        forceWebSearch={forceWebSearch}
        setForceWebSearch={setForceWebSearch}
        inputRef={inputRef as any}
              onKeyPress={handleKeyPress}
      />
    </div>
  )
}
