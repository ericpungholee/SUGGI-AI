import React from 'react'
import { ChatMessage } from './types'

export const useConversationHistory = (
  documentId: string | undefined,
  userId: string | undefined,
  generateMessageId: () => string
) => {
  const loadConversationHistory = async (setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) => {
    try {
      if (!userId) {
        console.log('📚 No authenticated session, skipping conversation history load')
        return
      }

      console.log('📚 Loading conversation history for document:', documentId)
      
      const response = await fetch(`/api/conversations?documentId=${documentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      console.log('📚 Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📚 Response data:', data)
        
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages || []
          
          const seenIds = new Set<string>()
          const deduplicatedMessages = loadedMessages.map((msg: ChatMessage) => {
            let messageId = msg.id || generateMessageId()
            
            while (seenIds.has(messageId)) {
              messageId = generateMessageId()
            }
            
            seenIds.add(messageId)
            return { ...msg, id: messageId }
          })
          
          setMessages(deduplicatedMessages)
          console.log('✅ Loaded conversation history:', {
            messageCount: deduplicatedMessages.length,
            lastMessage: deduplicatedMessages[deduplicatedMessages.length - 1]?.content?.substring(0, 50) + '...'
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
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.log('📚 Network error or user not authenticated, skipping conversation history load')
      } else {
        console.error('Failed to load conversation history:', error)
      }
    }
  }

  const saveConversationHistory = async (messagesToSave: ChatMessage[]) => {
    if (!documentId || !userId) return
    
    try {
      console.log('💾 Saving conversation history:', {
        documentId,
        messageCount: messagesToSave.length,
        userId
      })
      
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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

  const clearConversationHistory = async () => {
    if (!documentId) return
    
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

  return {
    loadConversationHistory,
    saveConversationHistory,
    clearConversationHistory
  }
}

