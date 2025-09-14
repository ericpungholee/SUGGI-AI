'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { 
  EditWorkflowState, 
  EditProposal, 
  TextDiffHunk, 
  EditRequest,
  ApplyEditResult 
} from '@/types'

interface UseEditWorkflowProps {
  documentId: string
  onContentChange?: (content: string) => void
}

export function useEditWorkflow({ documentId, onContentChange }: UseEditWorkflowProps) {
  const [state, setState] = useState<EditWorkflowState>('idle')
  const [proposal, setProposal] = useState<EditProposal | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const originalContentRef = useRef<string>('')

  const startEditWorkflow = useCallback(async (editRequest: EditRequest) => {
    console.log('startEditWorkflow called with:', editRequest);
    if (state !== 'idle') {
      console.warn('Edit workflow already in progress');
      return;
    }

    console.log('Starting edit workflow, setting state to planning');
    setIsLoading(true);
    setError(null);
    setState('planning');

    try {
      // Store original content for conflict detection
      originalContentRef.current = editRequest.scope === 'selection' 
        ? '' // Will be set when we get the selection
        : '' // Will be set from document

      // Use fetch with streaming for edit proposal
      const response = await fetch('/api/ai/edit/propose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editRequest)
      })

      if (!response.ok) {
        throw new Error('Failed to start edit workflow')
      }

      const proposal = await response.json()
      
      console.log('📦 Received proposal:', {
        id: proposal.id,
        hasPatch: !!proposal.patch,
        patchKeys: proposal.patch ? Object.keys(proposal.patch) : null,
        hunksCount: proposal.patch?.hunks?.length || 0,
        summary: proposal.patch?.summary
      });
      
      // Set the proposal and update state
      setProposal(proposal);
      setState('preview_ready');
      
      // Trigger preview in editor
      console.log('Checking for startEditPreview function:', {
        hasWindow: typeof window !== 'undefined',
        hasStartEditPreview: !!(window as any).startEditPreview,
        proposalPatch: proposal.patch
      });
      
      if (typeof window !== 'undefined' && (window as any).startEditPreview) {
        console.log('Triggering preview in editor with hunks:', proposal.patch.hunks);
        (window as any).startEditPreview(proposal.patch.hunks, proposal.patch.summary);
      } else {
        console.log('startEditPreview function not available');
      }

    } catch (error) {
      console.error('Error starting edit workflow:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setState('idle');
    } finally {
      setIsLoading(false);
    }
  }, [state])

  const acceptAll = useCallback(async () => {
    if (!proposal) return

    setState('applying')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/edit/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalId: proposal.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to apply edits: ${response.status}`)
      }

      const result: ApplyEditResult = await response.json()
      
      console.log('Apply result received:', {
        proposalId: result.proposalId,
        newContentLength: result.newContent?.length || 0,
        blocksApplied: result.blocksApplied,
        wordsAdded: result.wordsAdded,
        wordsRemoved: result.wordsRemoved
      });
      
      // Update document content
      if (onContentChange && result.newContent) {
        console.log('Calling onContentChange with new content');
        onContentChange(result.newContent);
      } else {
        console.log('onContentChange not called:', { onContentChange: !!onContentChange, hasNewContent: !!result.newContent });
      }
      
      // Update proposal status
      setProposal(prev => prev ? { ...prev, status: 'applied' } : null)
      setState('applied')
      
    } catch (error) {
      console.error('Error applying edits:', error)
      setError(error instanceof Error ? error.message : 'Failed to apply edits')
      setState('preview_ready')
    } finally {
      setIsLoading(false)
    }
  }, [proposal, onContentChange])

  const rejectAll = useCallback(async () => {
    if (!proposal) return

    try {
      const response = await fetch('/api/ai/edit/discard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalId: proposal.id,
          action: 'discard'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to discard proposal: ${response.status}`)
      }

      setProposal(null)
      setState('discarded')
      
    } catch (error) {
      console.error('Error discarding proposal:', error)
      setError(error instanceof Error ? error.message : 'Failed to discard proposal')
    }
  }, [proposal])

  const applySelected = useCallback(async (blockIds: string[]) => {
    if (!proposal) return

    setState('applying')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/edit/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalId: proposal.id,
          blockIds
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to apply selected edits: ${response.status}`)
      }

      const result: ApplyEditResult = await response.json()
      
      // Update document content
      onContentChange?.(result.newContent)
      
      // Update proposal status
      setProposal(prev => prev ? { ...prev, status: 'applied' } : null)
      setState('applied')
      
    } catch (error) {
      console.error('Error applying selected edits:', error)
      setError(error instanceof Error ? error.message : 'Failed to apply selected edits')
      setState('preview_ready')
    } finally {
      setIsLoading(false)
    }
  }, [proposal, onContentChange])

  const discard = useCallback(async () => {
    if (!proposal) return

    try {
      await fetch('/api/ai/edit/discard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalId: proposal.id
        })
      })

      setProposal(null)
      setState('discarded')
      
    } catch (error) {
      console.error('Error discarding proposal:', error)
      setError(error instanceof Error ? error.message : 'Failed to discard proposal')
    }
  }, [proposal])

  const undo = useCallback(() => {
    // This would integrate with the editor's undo system
    // For now, just reset the state
    setProposal(null)
    setState('idle')
    setConflicts([])
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setProposal(null)
    setConflicts([])
    setError(null)
    setIsLoading(false)
  }, [])

  // Detect conflicts when content changes
  const checkConflicts = useCallback((currentContent: string) => {
    if (!proposal || !originalContentRef.current) return

    const newConflicts: string[] = []
    
    for (const hunk of proposal.patch.hunks) {
      // Simple conflict detection - if the original content has changed
      const originalText = originalContentRef.current.substring(hunk.from, hunk.to)
      const currentText = currentContent.substring(hunk.from, hunk.to)
      
      if (originalText !== currentText) {
        newConflicts.push(hunk.blockId)
      }
    }
    
    setConflicts(newConflicts)
  }, [proposal])

  // Expose current proposal globally for editor access
  useEffect(() => {
    if (typeof window !== 'undefined' && window) {
      (window as any).getCurrentProposal = () => proposal
    }
  }, [proposal])

  return {
    state,
    proposal,
    conflicts,
    isLoading,
    error,
    startEditWorkflow,
    acceptAll,
    rejectAll,
    applySelected,
    discard,
    undo,
    reset,
    checkConflicts
  }
}
