'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { RealTimeEditAgentState, AgentTextBlock, AgentTypingSession, EditApprovalEvent } from '@/types'
import { processRealTimeEditRequest, createTypingBlocks } from '@/lib/ai/real-time-edit-agent'

interface UseRealTimeAgentTypingProps {
  documentId: string
  onTypingStart?: (session: AgentTypingSession) => void
  onTypingProgress?: (block: AgentTextBlock, progress: number) => void
  onTypingComplete?: (session: AgentTypingSession) => void
  onApprovalChange?: (event: EditApprovalEvent) => void
}

interface RealTimeTypingState {
  isTyping: boolean
  currentSession: AgentTypingSession | null
  currentBlock: AgentTextBlock | null
  pendingBlocks: AgentTextBlock[]
  approvedBlocks: AgentTextBlock[]
  typingProgress: number
  error: string | null
}

export function useRealTimeAgentTyping({
  documentId,
  onTypingStart,
  onTypingProgress,
  onTypingComplete,
  onApprovalChange
}: UseRealTimeAgentTypingProps) {
  const [state, setState] = useState<RealTimeTypingState>({
    isTyping: false,
    currentSession: null,
    currentBlock: null,
    pendingBlocks: [],
    approvedBlocks: [],
    typingProgress: 0,
    error: null
  })

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentTypingIndex = useRef(0)

  // Start a new typing session
  const startTypingSession = useCallback(async (userMessage: string, documentContent: string) => {
    console.log('🚀 Starting real-time typing session:', { userMessage, documentId })
    
    try {
      setState(prev => ({ ...prev, isTyping: true, error: null }))
      
      // Process the edit request through LangGraph
      const result: RealTimeEditAgentState = await processRealTimeEditRequest(
        userMessage,
        documentId,
        documentContent,
        []
      )

      console.log('📊 Received result from API:', {
        hasError: !!result.error,
        hasSession: !!result.agentTypingSession,
        hasBlocks: result.typingBlocks?.length || 0,
        processingStep: result.processingStep,
        detectedIntent: result.detectedIntent
      })

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.agentTypingSession) {
        console.log('⚠️ No typing session created - likely not an edit request')
        setState(prev => ({
          ...prev,
          isTyping: false,
          error: 'No edit request detected'
        }))
        return
      }

      const session = result.agentTypingSession
      const blocks = result.typingBlocks || []

      setState(prev => ({
        ...prev,
        currentSession: session,
        pendingBlocks: blocks,
        currentBlock: blocks[0] || null
      }))

      onTypingStart?.(session)

      // Start typing the first block
      if (blocks.length > 0) {
        await startTypingBlock(blocks[0])
      } else {
        console.log('⚠️ No typing blocks created')
        completeTypingSession()
      }

    } catch (error) {
      console.error('❌ Failed to start typing session:', error)
      setState(prev => ({
        ...prev,
        isTyping: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [documentId, onTypingStart])

  // Start typing a specific block
  const startTypingBlock = useCallback(async (block: AgentTextBlock) => {
    console.log('⌨️ Starting to type block:', block.id)
    
    setState(prev => ({
      ...prev,
      currentBlock: block,
      typingProgress: 0
    }))

    // Simulate typing animation
    await simulateTyping(block.content, block)
  }, [])

  // Simulate typing animation
  const simulateTyping = useCallback(async (content: string, block: AgentTextBlock) => {
    const typingSpeed = 50 // ms per character
    const pauseBetweenWords = 100 // ms
    const pauseBetweenSentences = 300 // ms
    
    let typedContent = ''
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      typedContent += char
      
      // Update progress
      const progress = (i + 1) / content.length
      setState(prev => ({
        ...prev,
        typingProgress: progress * 100
      }))

      onTypingProgress?.(block, progress)

      // Determine pause duration
      let pause = typingSpeed
      if (char === ' ') {
        pause = pauseBetweenWords
      } else if (char.match(/[.!?]/)) {
        pause = pauseBetweenSentences
      }

      // Wait for the pause duration
      await new Promise(resolve => {
        typingTimeoutRef.current = setTimeout(resolve, pause)
      })
    }

    // Mark block as completed
    completeTypingBlock(block)
  }, [onTypingProgress])

  // Complete the current typing block
  const completeTypingBlock = useCallback((block: AgentTextBlock) => {
    console.log('✅ Completed typing block:', block.id)
    
    const completedBlock: AgentTextBlock = {
      ...block,
      // Position will be set by the editor when the text is inserted
    }

    setState(prev => {
      const newPendingBlocks = prev.pendingBlocks.slice(1) // Remove first block
      const nextBlock = newPendingBlocks[0] || null

      // If there are more blocks, start typing the next one
      if (newPendingBlocks.length > 0) {
        setTimeout(() => {
          startTypingBlock(newPendingBlocks[0])
        }, 500) // Brief pause between blocks
      } else {
        // All blocks completed
        completeTypingSession()
      }

      return {
        ...prev,
        currentBlock: nextBlock,
        pendingBlocks: newPendingBlocks,
        approvedBlocks: [...prev.approvedBlocks, completedBlock]
      }
    })
  }, [startTypingBlock])

  // Complete the entire typing session
  const completeTypingSession = useCallback(() => {
    console.log('🎉 Completed typing session:', state.currentSession?.id)
    
    if (!state.currentSession) return

    const completedSession: AgentTypingSession = {
      ...state.currentSession,
      isActive: false,
      completedAt: new Date()
    }

    setState(prev => ({
      ...prev,
      isTyping: false,
      currentSession: completedSession,
      currentBlock: null,
      typingProgress: 100
    }))

    onTypingComplete?.(completedSession)
  }, [state.currentSession, onTypingComplete])

  // Approve a block (turn it from light blue to black)
  const approveBlock = useCallback((blockId: string) => {
    console.log('✅ Approving block:', blockId)
    
    setState(prev => ({
      ...prev,
      approvedBlocks: prev.approvedBlocks.map(block =>
        block.id === blockId
          ? { ...block, isApproved: true, approvedAt: new Date() }
          : block
      )
    }))

    onApprovalChange?.({
      blockId,
      action: 'approve',
      timestamp: new Date()
    })
  }, [onApprovalChange])

  // Reject a block (remove it)
  const rejectBlock = useCallback((blockId: string) => {
    console.log('❌ Rejecting block:', blockId)
    
    setState(prev => ({
      ...prev,
      approvedBlocks: prev.approvedBlocks.filter(block => block.id !== blockId)
    }))

    onApprovalChange?.({
      blockId,
      action: 'reject',
      timestamp: new Date()
    })
  }, [onApprovalChange])

  // Cancel the current typing session
  const cancelTypingSession = useCallback(() => {
    console.log('🛑 Cancelling typing session')
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    setState(prev => ({
      ...prev,
      isTyping: false,
      currentSession: prev.currentSession ? {
        ...prev.currentSession,
        isActive: false,
        completedAt: new Date()
      } : null,
      currentBlock: null,
      pendingBlocks: [],
      typingProgress: 0,
      error: 'Typing session cancelled'
    }))
  }, [])

  // Get all agent text blocks (pending + approved)
  const getAllAgentBlocks = useCallback(() => {
    return [...state.approvedBlocks, ...state.pendingBlocks]
  }, [state.approvedBlocks, state.pendingBlocks])

  // Get only approved blocks
  const getApprovedBlocks = useCallback(() => {
    return state.approvedBlocks.filter(block => block.isApproved)
  }, [state.approvedBlocks])

  // Get only pending approval blocks
  const getPendingApprovalBlocks = useCallback(() => {
    return state.approvedBlocks.filter(block => !block.isApproved)
  }, [state.approvedBlocks])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    isTyping: state.isTyping,
    currentSession: state.currentSession,
    currentBlock: state.currentBlock,
    pendingBlocks: state.pendingBlocks,
    approvedBlocks: state.approvedBlocks,
    typingProgress: state.typingProgress,
    error: state.error,

    // Actions
    startTypingSession,
    approveBlock,
    rejectBlock,
    cancelTypingSession,

    // Utilities
    getAllAgentBlocks,
    getApprovedBlocks,
    getPendingApprovalBlocks
  }
}
