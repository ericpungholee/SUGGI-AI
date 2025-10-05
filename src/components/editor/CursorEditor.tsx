'use client'
import { useState, useRef, useEffect, useCallback } from "react"
import { FormatState } from "@/types"
import AIChatPanel from './AIChatPanel'
import DirectEditManager from './DirectEditManager'
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
import './table-styles.css'
import './agent-text-styles.css'

export default function CursorEditor({ 
  documentId, 
  onContentChange
}: { 
  documentId: string
  onContentChange?: (content: string) => void
}) {
  // Direct reference to DirectEditManager
  const directEditManagerRef = useRef<any>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  // isUpdatingContentRef is now managed by useDocumentManagement hook
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
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

  // Save content to undo stack
  const saveToUndoStack = useCallback((newContent: string) => {
    setUndoStack(prev => [...prev, newContent].slice(-50))
    setRedoStack([])
  }, [])

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

  // Handle content changes (moved to onInput handler to prevent loops)

  // Handle applying AI-generated content through approval workflow
  const handleApplyChanges = useCallback((contentToApply: string, cursorPosition?: string) => {
    if (!editorRef.current) return
    
    console.log('✍️ Applying AI content to editor (pending approval):', contentToApply.substring(0, 100) + '...')
    
    // Determine anchor position based on cursor position
    let anchor: 'cursor' | 'end' | 'selection' = 'end'
    if (cursorPosition === 'beginning') {
      anchor = 'cursor'
    } else if (cursorPosition === 'selection') {
      anchor = 'selection'
    } else if (cursorPosition === 'middle') {
      anchor = 'cursor'
    } else {
      anchor = 'end'
    }
    
    // Use DirectEditManager for consistent content insertion
    console.log('🔍 DirectEditManager status:', {
      hasRef: !!directEditManagerRef.current,
      hasStartEdit: !!directEditManagerRef.current?.startEdit,
      contentLength: contentToApply.length,
      anchor
    })
    
    if (directEditManagerRef.current && directEditManagerRef.current.startEdit) {
      console.log('🚀 Using DirectEditManager with anchor:', anchor)
      directEditManagerRef.current.startEdit(contentToApply, anchor)
    } else {
      console.error('❌ DirectEditManager not ready - content insertion failed', {
        hasRef: !!directEditManagerRef.current,
        hasStartEdit: !!directEditManagerRef.current?.startEdit
      })
      // Show error message to user
      const errorMessage = 'Content generation failed - please try again.'
      console.error('Content insertion failed:', errorMessage)
    }
  }, [])

  // Content insertion is now handled by DirectEditManager for consistency


  // Format AI content with proper structure
  const formatAIContent = useCallback((content: string): string => {
    // Convert markdown-like content to properly formatted HTML
    if (!content.includes('<')) {
      let formattedContent = content
      
      // Convert headings
      formattedContent = formattedContent.replace(/^## (.+)$/gm, '<h2>$1</h2>')
      formattedContent = formattedContent.replace(/^# (.+)$/gm, '<h1>$1</h1>')
      
      // Convert bullet points
      formattedContent = formattedContent.replace(/^- (.+)$/gm, '<li>$1</li>')
      formattedContent = formattedContent.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      
      // Convert numbered lists
      formattedContent = formattedContent.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      formattedContent = formattedContent.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>')
      
      // Convert bold text
      formattedContent = formattedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      
      // Convert italic text
      formattedContent = formattedContent.replace(/\*(.+?)\*/g, '<em>$1</em>')
      
      // Split by double newlines to create paragraphs, but preserve HTML elements
      const sections = formattedContent.split(/\n\s*\n/).filter(s => s.trim())
      const processedSections = sections.map(section => {
        const trimmed = section.trim()
        
        // Skip if already an HTML element
        if (trimmed.startsWith('<h1>') || trimmed.startsWith('<h2>') || 
            trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>')) {
          return trimmed
        }
        
        // Wrap in paragraph if it's plain text
        return `<p>${trimmed}</p>`
      })
      
      return processedSections.join('')
    }
    
    return content
  }, [])


  // Handle reverting changes from AI
  const handleRevertChanges = useCallback(() => {
    console.log('🔄 Reverting AI changes - removing pending content')
    
    // Use direct reference to DirectEditManager
    if (directEditManagerRef.current && directEditManagerRef.current.rejectAllProposals) {
      directEditManagerRef.current.rejectAllProposals()
      console.log('✅ Used DirectEditManager to reject all proposals')
    } else if (editorRef.current) {
      // Fallback: direct DOM manipulation
      const pendingElements = editorRef.current.querySelectorAll('.agent-text-block[data-is-approved="false"]')
      pendingElements.forEach(element => {
        element.remove()
      })
      console.log('✅ Removed all pending AI content')
    }
  }, [])



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

  // Undo/Redo functionality
  const undo = useCallback(() => {
    if (undoStack.length === 0 || !editorRef.current) return
    
    const currentContent = editorRef.current.innerHTML
    const previousContent = undoStack[undoStack.length - 1]
    
    setRedoStack(prev => [...prev, currentContent])
    setUndoStack(prev => prev.slice(0, -1))
    
    isUpdatingContentRef.current = true
    editorRef.current.innerHTML = previousContent
    isUpdatingContentRef.current = false
    
    updateFormatState()
  }, [undoStack, updateFormatState])

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !editorRef.current) return
    
    const nextContent = redoStack[redoStack.length - 1]
    
    setUndoStack(prev => [...prev, editorRef.current!.innerHTML])
    setRedoStack(prev => prev.slice(0, -1))
    
    isUpdatingContentRef.current = true
    editorRef.current.innerHTML = nextContent
    isUpdatingContentRef.current = false
    
    updateFormatState()
  }, [redoStack, updateFormatState])

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
    
    // Handle Enter key for lists
    if (e.key === 'Enter') {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      
      const range = selection.getRangeAt(0)
      const container = range.startContainer
      const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
      
      if (element?.closest('li')) {
        e.preventDefault()
        // Let the browser handle list continuation
      }
    }
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

  // Load document content
  useEffect(() => {
    if (content && editorRef.current && !isUpdatingContentRef.current) {
      isUpdatingContentRef.current = true
      editorRef.current.innerHTML = content
      isUpdatingContentRef.current = false
      
      // Initialize undo stack
      setUndoStack([content])
      setRedoStack([])
      
      updateFormatState()
    }
  }, [content, updateFormatState])

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
        <div className="flex-1 flex flex-col">
          <div
            ref={editorRef}
            contentEditable
            dir="ltr"
            className="flex-1 p-6 overflow-y-auto focus:outline-none text-gray-900 leading-relaxed"
            style={{
              fontSize: '16px',
              lineHeight: '1.6',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              direction: 'ltr',
              textAlign: 'left'
            }}
            onInput={(e) => {
              if (isUpdatingContentRef.current) return
              
              const target = e.target as HTMLDivElement
              const newContent = target.innerHTML
              
              // Mark that user is actively typing
              markUserTyping()
              
              // Save to undo stack
              saveToUndoStack(newContent)
              
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
              onRevertChanges={handleRevertChanges}
              editorRef={editorRef}
              documentContent={content}
            />
          </div>
        )}
      </div>

      {/* Direct Edit Manager */}
      <DirectEditManager
        editorRef={editorRef}
        onContentChange={(newContent: string) => {
          // Handle content change from DirectEditManager
          saveToUndoStack(newContent)
          updateFormatState()
          
          // Update document state when content is approved (contains approved agent content)
          const hasApprovedContent = newContent.includes('data-is-approved="true"') || 
                                   newContent.includes('agent-text-block')
          
          if (hasApprovedContent) {
            console.log('✅ Updating document state with approved content')
            setContent(newContent)
          }
          
          if (onContentChange) {
            onContentChange(newContent)
          }
        }}
        onContentInserted={(proposalId) => {
          console.log('✅ Content inserted callback received:', proposalId)
        }}
        onManagerReady={(manager) => {
          console.log('✅ DirectEditManager ready')
          directEditManagerRef.current = manager
          // Also attach to editor element for easy access
          if (editorRef.current) {
            (editorRef.current as any).directEditManager = manager
          }
        }}
      />

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
