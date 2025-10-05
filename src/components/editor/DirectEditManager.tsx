'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Check, X, Eye, EyeOff } from 'lucide-react'
import { getTextPosition, getTextNodeAtPosition } from '@/lib/editor/position-utils'

interface DirectEditManagerProps {
  editorRef: React.RefObject<HTMLDivElement>
  onContentChange?: (content: string) => void
  onContentInserted?: (proposalId: string) => void
  onManagerReady?: (manager: any) => void
}

interface EditProposal {
  id: string
  content: string
  originalContent: string
  startPosition: number
  endPosition: number
  isVisible: boolean
  operations?: any[]
  structureImpact?: {
    sections_added: number
    sections_modified: number
    sections_removed: number
    formatting_changes: number
    hierarchy_changes: boolean
  }
  placementStrategy?: {
    position: 'beginning' | 'middle' | 'end' | 'specific'
    suggestedStructure: 'append' | 'insert' | 'replace' | 'enhance'
  }
}

export default function DirectEditManager({ 
  editorRef, 
  onContentChange,
  onContentInserted,
  onManagerReady
}: DirectEditManagerProps) {
  const [currentProposal, setCurrentProposal] = useState<EditProposal | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const originalContentRef = useRef<string>('')
  const proposalElementRef = useRef<HTMLSpanElement>(null)

  // Enhanced edit functionality is now handled by startEdit

  // Start a new edit proposal (legacy method)
  const startEdit = useCallback((content: string, anchor: 'cursor' | 'end' | 'selection' = 'end') => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const selection = window.getSelection()
    
    // Store original content
    originalContentRef.current = editor.textContent || ''

    let startPosition = 0
    let endPosition = 0
    let insertPosition = 0

    if (anchor === 'cursor' && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      insertPosition = getTextPosition(range.startContainer, editor)
      startPosition = insertPosition
      endPosition = insertPosition
    } else if (anchor === 'selection' && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      startPosition = getTextPosition(range.startContainer, editor)
      endPosition = getTextPosition(range.endContainer, editor)
      insertPosition = startPosition
    } else {
      // Default to end of document
      insertPosition = editor.textContent?.length || 0
      startPosition = insertPosition
      endPosition = insertPosition
    }
    
    // Special handling for beginning insertion
    if (anchor === 'cursor' && insertPosition <= 50) {
      // If cursor is near the beginning, insert at the very beginning
      insertPosition = 0
      startPosition = 0
      endPosition = 0
    }

    const proposal: EditProposal = {
      id: `proposal-${Date.now()}`,
      content,
      originalContent: originalContentRef.current,
      startPosition,
      endPosition,
      isVisible: true
    }

    setCurrentProposal(proposal)
    setShowPreview(true)
    
    // Insert the proposal content directly into the editor
    insertProposalContent(proposal)
    
    console.log('✅ Started direct edit proposal:', { 
      id: proposal.id, 
      contentLength: content.length,
      position: insertPosition 
    })
  }, [editorRef])

  // Insert proposal content with special styling
  const insertProposalContent = useCallback((proposal: EditProposal) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const selection = window.getSelection()
    
    // Clear any existing selection
    selection?.removeAllRanges()

    // Create range at the insert position
    const range = document.createRange()
    
    if (proposal.startPosition === proposal.endPosition) {
      // Insert at position
      const textNode = getTextNodeAtPosition(editor, proposal.startPosition)
      if (textNode) {
        range.setStart(textNode.node, textNode.offset)
        range.setEnd(textNode.node, textNode.offset)
      } else {
        // Fallback to end of document
        range.selectNodeContents(editor)
        range.collapse(false)
      }
    } else {
      // Replace selection
      const startNode = getTextNodeAtPosition(editor, proposal.startPosition)
      const endNode = getTextNodeAtPosition(editor, proposal.endPosition)
      if (startNode && endNode) {
        range.setStart(startNode.node, startNode.offset)
        range.setEnd(endNode.node, endNode.offset)
      }
    }

    // Clear the range content
    range.deleteContents()

    // Create a span element for the proposal content with pending styling
    const proposalSpan = document.createElement('span')
    proposalSpan.className = 'agent-text-block'
    proposalSpan.setAttribute('data-is-approved', 'false')
    proposalSpan.style.cssText = `
      color: #6b7280 !important;
      background: rgba(107, 114, 128, 0.1) !important;
      border-bottom: 1px solid #d1d5db !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      position: relative !important;
      transition: all 0.3s ease !important;
      display: inline-block !important;
      opacity: 1 !important;
      visibility: visible !important;
    `
    proposalSpan.innerHTML = proposal.content
    proposalSpan.setAttribute('data-proposal-id', proposal.id)

    // Insert the proposal span
    range.insertNode(proposalSpan)
    proposalElementRef.current = proposalSpan

    // Position cursor after the inserted content
    range.setStartAfter(proposalSpan)
    range.setEndAfter(proposalSpan)
    selection?.removeAllRanges()
    selection?.addRange(range)

    console.log('✅ Proposal content inserted into editor:', {
      proposalId: proposal.id,
      contentLength: proposal.content.length,
      elementVisible: proposalSpan.offsetParent !== null,
      elementInDOM: document.contains(proposalSpan),
      hasCorrectClass: proposalSpan.classList.contains('agent-text-block'),
      isApproved: proposalSpan.getAttribute('data-is-approved') === 'false',
      elementHTML: proposalSpan.outerHTML.substring(0, 100) + '...'
    })
    
    // Add a mutation observer to detect if the element gets removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node === proposalSpan) {
              console.log('🚨 PROPOSAL ELEMENT REMOVED FROM DOM!', {
                proposalId: proposal.id,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      })
    })
    
    if (editorRef.current) {
      observer.observe(editorRef.current, { childList: true, subtree: true })
      
      // Clean up observer after 10 seconds
      setTimeout(() => {
        observer.disconnect()
      }, 10000)
    }

    // Don't trigger onContentChange immediately to avoid conflicts with document management
    // The content change will be handled when the user approves/rejects the proposal
    
    // Notify that content was inserted
    if (onContentInserted) {
      onContentInserted(proposal.id)
    }

    // Focus the editor
    editor.focus()
  }, [editorRef, onContentChange, onContentInserted])

  // Accept the current proposal (called from chat panel)
  const acceptProposal = useCallback(() => {
    if (!currentProposal || !editorRef.current) return

    const editor = editorRef.current
    const proposalElement = proposalElementRef.current

    if (proposalElement) {
      // Change styling to approved (black text, no background)
      proposalElement.setAttribute('data-is-approved', 'true')
      proposalElement.style.cssText = `
        color: #000000 !important;
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        transition: all 0.3s ease !important;
      `

      // Remove the proposal ID since it's now permanent content
      proposalElement.removeAttribute('data-proposal-id')

      // Trigger content change to save the approved content
      if (onContentChange) {
        onContentChange(editor.innerHTML)
      }

      console.log('✅ Proposal accepted and saved to document')
    }

    // Clear the proposal
    setCurrentProposal(null)
    setShowPreview(false)
    proposalElementRef.current = null
  }, [currentProposal, editorRef, onContentChange])

  // Reject the current proposal (called from chat panel)
  const rejectProposal = useCallback(() => {
    if (!currentProposal || !editorRef.current) return

    const editor = editorRef.current
    const proposalElement = proposalElementRef.current

    if (proposalElement) {
      // Remove the proposal element completely
      proposalElement.remove()
      console.log('✅ Proposal rejected and removed from document')
    }

    // Clear the proposal
    setCurrentProposal(null)
    setShowPreview(false)
    proposalElementRef.current = null
  }, [currentProposal, editorRef])

  // Reject all proposals (used by revert function)
  const rejectAllProposals = useCallback(() => {
    if (!editorRef.current) return

    // Remove all pending agent content
    const pendingElements = editorRef.current.querySelectorAll('.agent-text-block[data-is-approved="false"]')
    pendingElements.forEach(element => {
      element.remove()
      console.log('❌ Removed pending proposal element')
    })

    // Clear current proposal state
    setCurrentProposal(null)
    setShowPreview(false)
    proposalElementRef.current = null

    console.log('✅ Rejected all pending proposals')
  }, [])

  // Toggle preview visibility
  const togglePreview = useCallback(() => {
    if (!currentProposal || !proposalElementRef.current) return

    const proposalElement = proposalElementRef.current
    setShowPreview(!showPreview)

    if (showPreview) {
      // Hide the proposal (make it transparent)
      proposalElement.style.opacity = '0.3'
      proposalElement.style.borderLeftColor = '#d1d5db'
      proposalElement.style.background = 'transparent'
    } else {
      // Show the proposal (restore styling)
      proposalElement.style.opacity = '1'
      proposalElement.style.borderLeftColor = '#3b82f6'
      proposalElement.style.background = 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)'
    }
  }, [currentProposal, showPreview])

  // Auto-accept proposal after timeout (optional)
  useEffect(() => {
    if (!currentProposal) return

    const timeout = setTimeout(() => {
      console.log('⏰ Auto-accepting proposal after timeout')
      acceptProposal()
    }, 30000) // 30 seconds

    return () => clearTimeout(timeout)
  }, [currentProposal, acceptProposal])

  // Expose methods for external use
  useEffect(() => {
    const manager = {
      startEdit,
      acceptProposal,
      rejectProposal,
      rejectAllProposals,
      togglePreview,
      currentProposal,
      isTyping
    }
    
    // Attach to editorRef for backward compatibility
    if (editorRef.current) {
      (editorRef.current as any).directEditManager = manager
    }
    
    // Also notify parent component
    if (onManagerReady) {
      onManagerReady(manager)
    }
  }, [startEdit, acceptProposal, rejectProposal, rejectAllProposals, togglePreview, currentProposal, isTyping, onManagerReady])

  return (
    <>
      {/* No approval popup - approval handled through chat panel only */}
    </>
  )
}

