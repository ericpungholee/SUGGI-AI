'use client'
import { useState, useRef, useEffect, useCallback } from "react"
import { FormatState } from "@/types"
import AIChatPanel from './AIChatPanel'
import EditorToolbar from './EditorToolbar'
import TableManager from './TableManager'
import { useDocumentManagement } from '@/hooks/useDocumentManagement'
import { useTableOperations } from '@/hooks/useTableOperations'
import { 
    toggleInlineFormat, 
    toggleBlockFormat, 
    applyListFormat, 
    applyAlignment, 
    applyLinkFormat, 
    applyBackgroundColor, 
    applyTextColor, 
    applyFontSize, 
    applyFontFamily 
} from '@/lib/editor/formatting-utils'
import { Trash2 } from "lucide-react"
import { useAgentEditManager } from './AgentEditManager'
import { formatAIContent } from './utils/aiContentFormatter'
import './table-styles.css'
import './agent-text-styles.css'

export default function CursorEditor({ 
  documentId, 
  onContentChange
}: { 
  documentId: string
  onContentChange?: (content: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // isUpdatingContentRef is now managed by useDocumentManagement hook
  const [undoStack, setUndoStack] = useState<Array<{ content: string; cursorPos: number | null }>>([])
  const [redoStack, setRedoStack] = useState<Array<{ content: string; cursorPos: number | null }>>([])
  // isUndoRedo state removed - not used
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false,
    color: '#000000',
    backgroundColor: 'transparent',
    fontSize: '16px',
    fontFamily: 'Arial, sans-serif',
    alignment: 'left',
    listType: 'none',
    headingLevel: 'none'
  })

  
  // AI Chat Panel state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const [aiChatWidth, setAiChatWidth] = useState(400)
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // isDeleting state is now managed by useDocumentManagement hook
  
  // Save state (managed by useDocumentManagement hook)

  // Navigation is handled by useDocumentManagement hook

  // Save cursor position before content change
  const saveCursorPosition = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return null
    
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(editorRef.current)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    const caretOffset = preCaretRange.toString().length
    
    return caretOffset
  }, [])

  // Restore cursor position after content change
  const restoreCursorPosition = useCallback((offset: number) => {
    if (!editorRef.current) return
    
    const selection = window.getSelection()
    if (!selection) return
    
    const range = document.createRange()
    let currentOffset = 0
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let node: Text | null = null
    while (node = walker.nextNode() as Text | null) {
      const nodeLength = node.textContent?.length || 0
      if (currentOffset + nodeLength >= offset) {
        range.setStart(node, offset - currentOffset)
        range.setEnd(node, offset - currentOffset)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      currentOffset += nodeLength
    }
    
    // Fallback to end
    range.selectNodeContents(editorRef.current)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  // Save content to undo stack
  const saveToUndoStack = useCallback((newContent: string) => {
    if (!editorRef.current) return
    
    const cursorPos = saveCursorPosition()
    
    // Only save if content actually changed
    setUndoStack(prev => {
      const lastState = prev[prev.length - 1]
      if (lastState && lastState.content === newContent) {
        return prev // Don't add duplicate
      }
      return [...prev, { content: newContent, cursorPos }].slice(-50)
    })
    setRedoStack([])
  }, [saveCursorPosition])

  // Update format state based on current selection
  const updateFormatState = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
    if (!element) return

    const newFormatState: Partial<FormatState> = {}
    
    // Check if the selection spans multiple elements with different formatting
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    
    const startElement = startContainer.nodeType === Node.ELEMENT_NODE ? startContainer as Element : startContainer.parentElement
    const endElement = endContainer.nodeType === Node.ELEMENT_NODE ? endContainer as Element : endContainer.parentElement
    
    if (!startElement || !endElement) return
    
    // Check if all selected text has the same formatting
    const startBold = !!startElement.closest('strong, b')
    const endBold = !!endElement.closest('strong, b')
    const startItalic = !!startElement.closest('em, i')
    const endItalic = !!endElement.closest('em, i')
    const startUnderline = !!startElement.closest('u')
    const endUnderline = !!endElement.closest('u')
    const startStrikethrough = !!startElement.closest('s, strike')
    const endStrikethrough = !!endElement.closest('s, strike')
    
    newFormatState.bold = startBold && endBold
    newFormatState.italic = startItalic && endItalic
    newFormatState.underline = startUnderline && endUnderline
    newFormatState.strikethrough = startStrikethrough && endStrikethrough
    
    // Check text color
    const startColor = window.getComputedStyle(startElement).color
    const endColor = window.getComputedStyle(endElement).color
    newFormatState.color = startColor === endColor ? startColor : '#000000'
    
    // Check background color
    const startBgColor = window.getComputedStyle(startElement).backgroundColor
    const endBgColor = window.getComputedStyle(endElement).backgroundColor
    newFormatState.backgroundColor = startBgColor === endBgColor && startBgColor !== 'rgba(0, 0, 0, 0)' ? startBgColor : 'transparent'
    
    // Check font size
    const startFontSize = window.getComputedStyle(startElement).fontSize
    const endFontSize = window.getComputedStyle(endElement).fontSize
    newFormatState.fontSize = startFontSize === endFontSize ? startFontSize : '16px'
    
    // Check font family
    const startFontFamily = window.getComputedStyle(startElement).fontFamily
    const endFontFamily = window.getComputedStyle(endElement).fontFamily
    newFormatState.fontFamily = startFontFamily === endFontFamily ? startFontFamily : 'Arial, sans-serif'
    
    // Check alignment
    const startAlignment = window.getComputedStyle(startElement).textAlign
    const endAlignment = window.getComputedStyle(endElement).textAlign
    newFormatState.alignment = startAlignment === endAlignment ? startAlignment : 'left'
    
    // Check list type
    if (startElement.closest('ul') && endElement.closest('ul')) {
      newFormatState.listType = 'bullet'
    } else if (startElement.closest('ol') && endElement.closest('ol')) {
      newFormatState.listType = 'numbered'
    } else {
      newFormatState.listType = 'none'
    }
    
    // Check heading level
    const startHeading = startElement.closest('h1, h2, h3, h4, h5, h6')
    const endHeading = endElement.closest('h1, h2, h3, h4, h5, h6')
    if (startHeading && endHeading && startHeading.tagName === endHeading.tagName) {
      newFormatState.headingLevel = startHeading.tagName.toLowerCase()
    } else {
      newFormatState.headingLevel = 'none'
    }
    
    setFormatState(prev => ({ ...prev, ...newFormatState }))
  }, [])

  // Document management hook (must be declared before content handling functions)
  const { 
    content,
    setContent,
    documentTitle,
    setDocumentTitle,
    isLoading,
    isSaving,
    isSavingTitle,
    setIsSavingTitle,
    saveError,
    hasUnsavedChanges,
    justSaved,
    isDeleting,
    saveDocument,
    handleManualSave,
    handleDeleteDocument,
    handleNavigation,
    cleanEditorContent,
    isUpdatingContentRef,
    markUserTyping
  } = useDocumentManagement(documentId, editorRef, (newContent: string) => {
    // This is the onContentChange callback for the hook
    if (onContentChange) {
      onContentChange(newContent)
    }
  })

  // Agent edit manager for handling AI-generated edits
  const agentEditManager = useAgentEditManager(editorRef, (newContent: string) => {
    // Save to undo stack
    saveToUndoStack(newContent)
    updateFormatState()
    // Notify parent
    if (onContentChange) {
      onContentChange(newContent)
    }
  })

  // Handle applying AI-generated content using AgentEditManager
  const handleApplyChanges = useCallback((contentToApply: string, cursorPosition?: string) => {
    if (!agentEditManager) return
    
    // Handle delete all command - use AgentEditManager for pending state
    if (contentToApply === '' || contentToApply.trim() === '') {
      // Store original content before delete
      const originalContent = editorRef.current?.innerHTML || ''
      
      // Use AgentEditManager to apply delete in pending state
      const editId = (agentEditManager as any).applyDeleteAll?.(originalContent)
      if (editId) {
        // Store edit ID in editor ref for chat panel access
        if (editorRef.current) {
          (editorRef.current as any).lastAgentEditId = editId
        }
        return editId
      }
      
      // Fallback: if applyDeleteAll doesn't exist, just clear (but this shouldn't happen)
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
        saveToUndoStack('')
        updateFormatState()
        if (onContentChange) {
          onContentChange('')
        }
      }
      return ''
    }
    
    // Format content if needed (convert markdown to HTML)
    const formattedContent = formatAIContent(contentToApply)
    
    // Apply edit using AgentEditManager (will show in gray)
    const editId = agentEditManager.applyEdit(formattedContent, cursorPosition)
    
    // Store edit ID in editor ref for chat panel access
    if (editorRef.current) {
      (editorRef.current as any).lastAgentEditId = editId
    }
    
    return editId
  }, [agentEditManager, saveToUndoStack, updateFormatState, onContentChange, editorRef])



  // Handle formatting
  const handleFormat = useCallback((format: string, value?: string) => {
    if (!editorRef.current) return
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    
    const range = selection.getRangeAt(0)
    
    switch (format) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
      case 'strikeThrough':
        toggleInlineFormat(format, range)
        break
      case 'heading':
      case 'formatBlock':
        toggleBlockFormat(value || 'h1', range)
        break
      case 'list':
      case 'insertUnorderedList':
      case 'insertOrderedList':
        if (format === 'insertUnorderedList') {
          applyListFormat('bullet', range)
        } else if (format === 'insertOrderedList') {
          applyListFormat('numbered', range)
        } else {
        applyListFormat(value as 'bullet' | 'numbered', range)
        }
        break
      case 'alignment':
      case 'justifyLeft':
      case 'justifyCenter':
      case 'justifyRight':
      case 'justifyFull':
        if (format === 'justifyLeft') {
          applyAlignment('left', range)
        } else if (format === 'justifyCenter') {
          applyAlignment('center', range)
        } else if (format === 'justifyRight') {
          applyAlignment('right', range)
        } else if (format === 'justifyFull') {
          applyAlignment('justify', range)
        } else {
        applyAlignment(value as 'left' | 'center' | 'right' | 'justify', range)
        }
        break
      case 'link':
      case 'createLink':
        if (value) applyLinkFormat(value, range)
        break
      case 'color':
      case 'foreColor':
        if (value) applyTextColor(value, range)
        break
      case 'backgroundColor':
        if (value) applyBackgroundColor(value, range)
        break
      case 'fontSize':
        if (value) applyFontSize(value, range)
        break
      case 'fontFamily':
        if (value) applyFontFamily(value, range)
        break
    }
    
    // Update format state
    updateFormatState()
    
    // Save to undo stack (don't call setContent to avoid reverse text)
    const newContent = editorRef.current.innerHTML
    saveToUndoStack(newContent)
    
    // Call parent callback
    if (onContentChange) {
      onContentChange(newContent)
    }
    
    // Keep focus on editor
    editorRef.current.focus()
  }, [saveToUndoStack, updateFormatState, onContentChange])

  // Undo/Redo functionality with cursor preservation
  const undo = useCallback(() => {
    if (undoStack.length <= 1 || !editorRef.current) return // Need at least 2 items (current + previous)
    
    const currentContent = editorRef.current.innerHTML
    const currentCursorPos = saveCursorPosition()
    const previousState = undoStack[undoStack.length - 1]
    
    // Save current state to redo stack
    setRedoStack(prev => [...prev, { content: currentContent, cursorPos: currentCursorPos }])
    
    // Remove last state from undo stack
    setUndoStack(prev => prev.slice(0, -1))
    
    // Update editor content
    isUpdatingContentRef.current = true
    editorRef.current.innerHTML = previousState.content
    isUpdatingContentRef.current = false
    
    // Restore cursor position
    requestAnimationFrame(() => {
      if (previousState.cursorPos !== null) {
        restoreCursorPosition(previousState.cursorPos)
      } else {
        // If no cursor pos saved, place at end
        const range = document.createRange()
        range.selectNodeContents(editorRef.current!)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      updateFormatState()
    })
  }, [undoStack, saveCursorPosition, restoreCursorPosition, updateFormatState])

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !editorRef.current) return
    
    const currentContent = editorRef.current.innerHTML
    const currentCursorPos = saveCursorPosition()
    const nextState = redoStack[redoStack.length - 1]
    
    // Save current state to undo stack
    setUndoStack(prev => [...prev, { content: currentContent, cursorPos: currentCursorPos }])
    
    // Remove last state from redo stack
    setRedoStack(prev => prev.slice(0, -1))
    
    // Update editor content
    isUpdatingContentRef.current = true
    editorRef.current.innerHTML = nextState.content
    isUpdatingContentRef.current = false
    
    // Restore cursor position
    requestAnimationFrame(() => {
      if (nextState.cursorPos !== null) {
        restoreCursorPosition(nextState.cursorPos)
      } else {
        // If no cursor pos saved, place at end
        const range = document.createRange()
        range.selectNodeContents(editorRef.current!)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      updateFormatState()
    })
  }, [redoStack, saveCursorPosition, restoreCursorPosition, updateFormatState])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            redo()
          } else {
            undo()
          }
          break
        case 'y':
          e.preventDefault()
          redo()
          break
        case 's':
          e.preventDefault()
          handleManualSave()
          break
        case 'b':
          e.preventDefault()
          handleFormat('bold')
          break
        case 'i':
          e.preventDefault()
          handleFormat('italic')
          break
        case 'u':
          e.preventDefault()
          handleFormat('underline')
          break
        case 'k':
          e.preventDefault()
          const url = prompt('Enter URL:')
          if (url) handleFormat('link', url)
          break
      }
    }
    
    // Don't interfere with normal editing keys - let browser handle them
    // Delete, Backspace, Enter, Arrow keys, etc. should work normally
  }, [undo, redo, handleFormat, handleManualSave])

  // Document management hook is now declared above

  // Handle save
  const handleSave = useCallback(async () => {
    await handleManualSave()
  }, [handleManualSave])

  // Handle delete
  const handleDelete = useCallback(async () => {
    await handleDeleteDocument()
  }, [handleDeleteDocument])

  // Load document content - only on initial load or document change
  const previousDocumentIdRef = useRef<string>(documentId)
  const isInitializedRef = useRef<boolean>(false)
  
  useEffect(() => {
    // Only update if document ID changed (new document loaded)
    if (previousDocumentIdRef.current !== documentId) {
      previousDocumentIdRef.current = documentId
      isInitializedRef.current = false
      if (content && editorRef.current) {
        isUpdatingContentRef.current = true
        editorRef.current.innerHTML = content
        isUpdatingContentRef.current = false
        
        // Initialize undo stack with initial content
        setUndoStack([{ content, cursorPos: null }])
        setRedoStack([])
        
        updateFormatState()
      }
    }
  }, [documentId, updateFormatState])
  
  // Initialize editor with content on mount
  useEffect(() => {
    if (content && editorRef.current && !isInitializedRef.current && !isUpdatingContentRef.current) {
      isUpdatingContentRef.current = true
      editorRef.current.innerHTML = content
      isUpdatingContentRef.current = false
      isInitializedRef.current = true
      
      // Initialize undo stack with initial content
      setUndoStack([{ content, cursorPos: null }])
      setRedoStack([])
      
      // Focus editor after a brief delay
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus()
          // Place cursor at end
          const range = document.createRange()
          range.selectNodeContents(editorRef.current)
          range.collapse(false)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
      }, 100)
    }
  }, [content])

  // Table operations
  const tableOps = useTableOperations(
    editorRef,
    saveToUndoStack,
    updateFormatState
  )

  // Image operations hook available but not currently used

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading document...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <EditorToolbar
        onNavigate={handleNavigation}
        documentId={documentId}
        documentTitle={documentTitle}
        onTitleChange={async (newTitle: string) => {
          setDocumentTitle(newTitle)
        }}
        onSave={handleManualSave}
        onDelete={() => setShowDeleteConfirm(true)}
        isSaving={isSaving}
        justSaved={justSaved}
        hasUnsavedChanges={hasUnsavedChanges}
        saveError={saveError}
        isLoading={isLoading}
        isSavingTitle={isSavingTitle}
        formatState={formatState}
        onFormat={handleFormat}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onShowTableManager={() => {
          const insideTable = tableOps.checkIfInsideTable()
          tableOps.setIsInsideTable(insideTable)
          tableOps.setShowTableManager(true)
        }}
        checkIfInsideTable={tableOps.checkIfInsideTable}
        isAIChatOpen={isAIChatOpen}
        onToggleAIChat={() => setIsAIChatOpen(!isAIChatOpen)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-center">
              <div
                ref={editorRef}
                contentEditable
                dir="ltr"
              className="w-full max-w-4xl px-8 py-6 focus:outline-none text-gray-900 leading-relaxed"
              style={{
                fontSize: '16px',
                lineHeight: '1.6',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                minHeight: '100%',
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 1,
                caretColor: '#000000',
                cursor: 'text'
              }}
              onClick={(e) => {
                // Ensure editor gets focus on click
                if (editorRef.current && document.activeElement !== editorRef.current) {
                  editorRef.current.focus()
                }
              }}
              onFocus={(e) => {
                // Ensure cursor is visible when focused
                const selection = window.getSelection()
                if (selection && selection.rangeCount === 0) {
                  const range = document.createRange()
                  range.selectNodeContents(e.currentTarget)
                  range.collapse(false)
                  selection.addRange(range)
                }
              }}
              onInput={(e) => {
                if (isUpdatingContentRef.current) return
                
                const target = e.target as HTMLDivElement
                const newContent = target.innerHTML
                
                // Mark that user is actively typing
                markUserTyping()
                
                // Save to undo stack immediately on first change, then debounce
                setUndoStack(prev => {
                  // If this is the first edit (only initial state in stack), save immediately
                  if (prev.length === 1) {
                    const cursorPos = saveCursorPosition()
                    return [...prev, { content: newContent, cursorPos }]
                  }
                  return prev
                })
                
                // Clear previous timeout
                if (undoTimeoutRef.current) {
                  clearTimeout(undoTimeoutRef.current)
                }
                
                // Save to undo stack (debounced to avoid too many entries)
                undoTimeoutRef.current = setTimeout(() => {
                  saveToUndoStack(newContent)
                  undoTimeoutRef.current = null
                }, 500)
                
                // Update format state
                updateFormatState()
                
                // Don't update content state immediately to prevent cursor issues
                // The markUserTyping() will handle content sync after user stops typing
                
                // Call parent callback
                if (onContentChange) {
                  onContentChange(newContent)
                }
              }}
              onKeyDown={handleKeyDown}
              onMouseUp={updateFormatState}
              onKeyUp={updateFormatState}
              suppressContentEditableWarning={true}
              />
            </div>
          </div>
        </div>

        {/* AI Chat Panel */}
        {isAIChatOpen && (
          <div 
            className="border-l border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out"
            style={{ width: `${aiChatWidth}px` }}
          >
            <AIChatPanel
              isOpen={isAIChatOpen}
              onClose={() => setIsAIChatOpen(false)}
              width={aiChatWidth}
              documentId={documentId}
              onApplyChanges={handleApplyChanges}
              editorRef={editorRef}
              documentContent={content}
              agentEditManager={agentEditManager}
              onContentChange={onContentChange}
            />
          </div>
        )}
      </div>


      {/* Table Manager */}
      <TableManager
        isOpen={tableOps.showTableManager}
        onClose={() => tableOps.setShowTableManager(false)}
        onInsertTable={tableOps.insertTable}
        isInsideTable={tableOps.isInsideTable}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Document</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete "{documentTitle}"? This will permanently remove the document and all its content.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center justify-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
