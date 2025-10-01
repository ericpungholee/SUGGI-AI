'use client'
import { useState, useRef, useEffect, useCallback } from "react";
import { FormatState } from "@/types";
import AIChatPanel from './AIChatPanel';
import EditorToolbar from './EditorToolbar';
import TableManager from './TableManager';
import { AgentTextBlock, AgentTypingSession } from '@/types';
import { createEditorAgent, AIEditorAgent } from '@/lib/ai/editor-agent';
import { useDocumentManagement } from '@/hooks/useDocumentManagement';
import { useTableOperations } from '@/hooks/useTableOperations';
import { useImageOperations } from '@/hooks/useImageOperations';
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
} from '@/lib/editor/formatting-utils';
import { Trash2 } from "lucide-react";
import './table-styles.css';

export default function Editor({ 
  documentId, 
  onContentChange
}: { 
  documentId: string; 
  onContentChange?: (content: string) => void;
}) {
    const editorRef = useRef<HTMLDivElement>(null)
    const isUpdatingContentRef = useRef(false)
    const [undoStack, setUndoStack] = useState<string[]>([])
    const [redoStack, setRedoStack] = useState<string[]>([])
    const [isUndoRedo, setIsUndoRedo] = useState(false)
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
    
    // Agentic editing state
    const [agentBlocks, setAgentBlocks] = useState<AgentTextBlock[]>([])
    const [currentAgentBlock, setCurrentAgentBlock] = useState<AgentTextBlock | null>(null)
    const [agentTypingSession, setAgentTypingSession] = useState<AgentTypingSession | null>(null)
    const [isLiveTyping, setIsLiveTyping] = useState(false)
    
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
        
        // Only set to true if ALL selected text has the same formatting
        newFormatState.bold = startBold && endBold
        newFormatState.italic = startItalic && endItalic
        newFormatState.underline = startUnderline && endUnderline
        newFormatState.strikethrough = startStrikethrough && endStrikethrough
        
        // For single elements, check the current element
        if (range.collapsed) {
            newFormatState.bold = !!element.closest('strong, b')
            newFormatState.italic = !!element.closest('em, i')
            newFormatState.underline = !!element.closest('u')
            newFormatState.strikethrough = !!element.closest('s, strike')
        }
        
        newFormatState.subscript = !!element.closest('sub')
        newFormatState.superscript = !!element.closest('sup')
        
        const computedStyle = window.getComputedStyle(element)
        newFormatState.color = computedStyle.color
        newFormatState.backgroundColor = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computedStyle.backgroundColor : 'transparent'
        
        // Only update fontSize and fontFamily if there's an actual text selection
        if (!range.collapsed && range.toString().trim().length > 0) {
            newFormatState.fontSize = computedStyle.fontSize
            newFormatState.fontFamily = computedStyle.fontFamily
        } else {
            newFormatState.fontSize = newFormatState.fontSize || '16px'
            newFormatState.fontFamily = newFormatState.fontFamily || 'Arial, sans-serif'
        }
        
        if (element.closest('p, div, h1, h2, h3, h4, h5, h6')) {
            const blockElement = element.closest('p, div, h1, h2, h3, h4, h5, h6') as Element
            const textAlign = window.getComputedStyle(blockElement).textAlign
            newFormatState.alignment = textAlign
        }
        
        if (element.closest('ul')) {
            newFormatState.listType = 'unordered'
        } else if (element.closest('ol')) {
            newFormatState.listType = 'ordered'
        } else {
            newFormatState.listType = 'none'
        }
        
        // Check if the cursor is in a heading or paragraph, or if the selection spans one
        let headingLevel = 'none'
        
        if (range.collapsed) {
            const headingElement = element.closest('h1, h2, h3, h4, h5, h6')
            if (headingElement) {
                headingLevel = headingElement.tagName.toLowerCase()
            } else {
                const paragraphElement = element.closest('p')
                if (paragraphElement) {
                    headingLevel = 'p'
                }
            }
        } else {
            const startBlock = startElement.closest('h1, h2, h3, h4, h5, h6, p')
            const endBlock = endElement.closest('h1, h2, h3, h4, h5, h6, p')
            
            if (startBlock && endBlock && startBlock === endBlock) {
                const tagName = startBlock.tagName.toLowerCase()
                if (tagName === 'p' || tagName.startsWith('h')) {
                    headingLevel = tagName
                }
            }
        }
        
        newFormatState.headingLevel = headingLevel
        
        setFormatState(prev => ({ ...prev, ...newFormatState }))
    }, [])

    // Use custom hooks for different functionalities
    const documentManagement = useDocumentManagement(documentId, editorRef as React.RefObject<HTMLDivElement>, onContentChange)
    const tableOperations = useTableOperations(editorRef as React.RefObject<HTMLDivElement>, saveToUndoStack, updateFormatState)
    const imageOperations = useImageOperations(editorRef as React.RefObject<HTMLDivElement>, saveToUndoStack)
    
    // Destructure document management state and functions
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
        showDeleteConfirm,
        setShowDeleteConfirm,
        mounted,
        isUserTyping,
        setIsUserTyping,
        isAgentTyping,
        setIsAgentTyping,
        handleManualSave,
        handleDeleteDocument,
        handleNavigation,
        cleanEditorContent
    } = documentManagement
    
    // Destructure table operations
    const {
        showTableManager,
        setShowTableManager,
        checkIfInsideTable,
        insertTable
    } = tableOperations
    
    // Destructure image operations
    const {
        insertImageFromFile
    } = imageOperations
    
    // Create AI Editor Agent
    const [editorAgent, setEditorAgent] = useState<AIEditorAgent | null>(null)
    
    // Create editor agent when ref becomes available
    useEffect(() => {
        if (mounted && editorRef.current && !editorAgent) {
            console.log('🔍 Creating editor agent:', {
                hasEditorRef: !!editorRef.current,
                editorRefType: typeof editorRef,
                hasOnContentChange: !!onContentChange,
                mounted: mounted
            })
            
            const agent = createEditorAgent(editorRef as React.RefObject<HTMLDivElement>, onContentChange, saveToUndoStack)
            console.log('✅ Editor agent created:', {
                hasWriteContent: typeof agent.writeContent === 'function',
                agentType: typeof agent
            })
            setEditorAgent(agent)
        }
    }, [mounted, onContentChange, saveToUndoStack])

    // Also recreate agent when editorRef changes
    useEffect(() => {
        if (mounted && editorRef.current && editorAgent) {
            console.log('🔄 Editor ref changed, recreating agent')
            const agent = createEditorAgent(editorRef as React.RefObject<HTMLDivElement>, onContentChange, saveToUndoStack)
            setEditorAgent(agent)
        }
    }, [editorRef.current, mounted, onContentChange, saveToUndoStack])
    
    // Expose document content getter to parent components
    useEffect(() => {
        if (typeof window === 'undefined') return
        
        try {
            ;(window as any).getCurrentDocumentContent = () => {
                return editorRef.current?.innerText || ''
            }
        } catch (error) {
            console.warn('Failed to set window properties:', error)
        }
    }, [])

    // Helper function to reset format state
    const resetFormatState = useCallback(() => {
        setFormatState(prev => ({
            ...prev,
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
        }))
    }, [])

    // Ensure content is displayed in editor when content state changes
    useEffect(() => {
        if (editorRef.current && content && !isUpdatingContentRef.current) {
            editorRef.current.innerHTML = content
        }
    }, [content])

    // Undo functionality
    const undo = useCallback(() => {
        if (undoStack.length > 1) {
            const currentContent = undoStack[undoStack.length - 1]
            const previousContent = undoStack[undoStack.length - 2]
            
            setRedoStack(prev => [...prev, currentContent])
            setUndoStack(prev => prev.slice(0, -1))
            
            if (editorRef.current) {
                setIsUndoRedo(true)
                editorRef.current.innerHTML = previousContent
                setContent(previousContent)
                setTimeout(() => {
                    updateFormatState()
                    setIsUndoRedo(false)
                }, 0)
            }
        }
    }, [undoStack, updateFormatState, setContent])

    // Redo functionality
    const redo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextContent = redoStack[redoStack.length - 1]
            
            setUndoStack(prev => [...prev, nextContent])
            setRedoStack(prev => prev.slice(0, -1))
            
            if (editorRef.current) {
                setIsUndoRedo(true)
                editorRef.current.innerHTML = nextContent
                setContent(nextContent)
                setTimeout(() => {
                    updateFormatState()
                    setIsUndoRedo(false)
                }, 0)
            }
        }
    }, [redoStack, updateFormatState, setContent])

    const handleFormat = useCallback((command: string, value?: string) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        if (!range) return

        if (editorRef.current) {
            saveToUndoStack(editorRef.current.innerHTML)
        }

        try {
            let success = false
            
            switch (command) {
                case 'bold':
                    success = toggleInlineFormat('strong', range)
                    break
                case 'italic':
                    success = toggleInlineFormat('em', range)
                    break
                case 'underline':
                    success = toggleInlineFormat('u', range)
                    break
                case 'strikeThrough':
                    success = toggleInlineFormat('s', range)
                    break
                case 'subscript':
                    success = toggleInlineFormat('sub', range)
                    break
                case 'superscript':
                    success = toggleInlineFormat('sup', range)
                    break
                case 'insertUnorderedList':
                    success = applyListFormat('ul', range)
                    break
                case 'insertOrderedList':
                    success = applyListFormat('ol', range)
                    break
                case 'justifyLeft':
                    success = applyAlignment('left', range)
                    break
                case 'justifyCenter':
                    success = applyAlignment('center', range)
                    break
                case 'justifyRight':
                    success = applyAlignment('right', range)
                    break
                case 'justifyFull':
                    success = applyAlignment('justify', range)
                    break
                case 'formatBlock':
                    if (value) {
                        success = toggleBlockFormat(value, range)
                    }
                    break
                case 'createLink':
                    if (value) {
                        success = applyLinkFormat(value, range)
                    }
                    break
                case 'backColor':
                    if (value) {
                        success = applyBackgroundColor(value, range)
                    }
                    break
                case 'foreColor':
                    if (value) {
                        success = applyTextColor(value, range)
                    }
                    break
                case 'fontSize':
                    if (value) {
                        success = applyFontSize(value, range)
                    }
                    break
                case 'fontFamily':
                    if (value) {
                        success = applyFontFamily(value, range)
                    }
                    break
                case 'insertTable':
                    setShowTableManager(true)
                    success = true
                    break
            }
            
            if (success) {
                if (editorRef.current) {
                    const newContent = editorRef.current.innerHTML
                    setContent(newContent)
                    setTimeout(() => {
                        editorRef.current?.focus()
                    }, 10)
                }
                updateFormatState()
            }
            
        } catch (error) {
            console.error('Error applying format:', error)
        }
    }, [saveToUndoStack, updateFormatState, setContent, setShowTableManager])

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const isCtrl = e.ctrlKey || e.metaKey
        const isShift = e.shiftKey

        if (isCtrl) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault()
                    handleManualSave()
                    break
                case 'delete':
                    if (documentId !== 'new') {
                        e.preventDefault()
                        setShowDeleteConfirm(true)
                    }
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
                    const url = prompt('Enter the URL:')
                    if (url) handleFormat('createLink', url)
                    break
                case 'z':
                    e.preventDefault()
                    if (isShift) {
                        redo()
                    } else {
                        undo()
                    }
                    break
                case '0':
                    e.preventDefault()
                    handleFormat('formatBlock', 'p')
                    break
                case '1':
                case '2':
                case '3':
                case '4':
                    e.preventDefault()
                    const level = e.key
                    handleFormat('formatBlock', `h${level}`)
                    break
                case 'l':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('insertUnorderedList')
                    } else {
                        e.preventDefault()
                        handleFormat('justifyLeft')
                    }
                    break
                case 'e':
                    e.preventDefault()
                    handleFormat('justifyCenter')
                    break
                case 'r':
                    e.preventDefault()
                    handleFormat('justifyRight')
                    break
                case 'j':
                    e.preventDefault()
                    handleFormat('justifyFull')
                    break
                case 'o':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('insertOrderedList')
                    }
                    break
                case 't':
                    if (isShift) {
                        e.preventDefault()
                        setShowTableManager(true)
                    }
                    break
            }
        }
     }, [handleFormat, undo, redo, handleManualSave, checkIfInsideTable, setShowTableManager])

    // Handle content changes from the editor
    const handleContentChange = useCallback(() => {
        if (editorRef.current && !isUndoRedo && !isUpdatingContentRef.current) {
            const newContent = editorRef.current.innerHTML
            
            if (newContent !== content) {
                isUpdatingContentRef.current = true
                setContent(newContent)
                saveToUndoStack(newContent)
                
                if (!isAgentTyping) {
                    setIsUserTyping(true)
                }
                
                onContentChange?.(newContent)
                
                setTimeout(() => {
                    isUpdatingContentRef.current = false
                }, 10)
            }
        }
    }, [saveToUndoStack, isUndoRedo, isAgentTyping, content, onContentChange, setContent, setIsUserTyping])

    // Handle paste events to capture images
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items)
        const imageItem = items.find(item => item.type.startsWith('image/'))
        
        if (imageItem) {
            e.preventDefault()
            const file = imageItem.getAsFile()
            if (file) {
                insertImageFromFile(file)
            }
        }
    }, [insertImageFromFile])

    // Handle drag and drop for images
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files)
        const imageFile = files.find(file => file.type.startsWith('image/'))
        
        if (imageFile) {
            insertImageFromFile(imageFile)
        }
    }, [insertImageFromFile])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    // Add selection change listener
    useEffect(() => {
        if (!mounted) return
        
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                if (range.toString().length > 0 || range.collapsed) {
                    setTimeout(() => updateFormatState(), 0)
                } else {
                    if (!editorRef.current?.contains(selection.anchorNode)) {
                        resetFormatState()
                    }
                }
            } else {
                resetFormatState()
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [updateFormatState, resetFormatState, mounted])

    const getWordCount = () => {
        const text = content.replace(/<[^>]*>/g, '')
        return text.split(/\s+/).filter(Boolean).length
    }

    const getCharCount = () => {
        return content.replace(/<[^>]*>/g, '').length
    }

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading document...</p>
                </div>
            </div>
        )
    }

    // Don't render editor until mounted to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing editor...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col relative">
            <div className={`flex-1 flex flex-col relative transition-all duration-300 ease-in-out`} style={{ marginRight: isAIChatOpen ? `${aiChatWidth}px` : '0px' }}>
            
            {/* Toolbar */}
            <EditorToolbar
                onNavigate={handleNavigation}
                documentId={documentId}
                documentTitle={documentTitle}
                onTitleChange={setDocumentTitle}
                onSave={handleManualSave}
                onDelete={() => setShowDeleteConfirm(true)}
                isSaving={isSaving}
                justSaved={justSaved}
                hasUnsavedChanges={hasUnsavedChanges}
                saveError={saveError}
                isLoading={isLoading}
                isSavingTitle={isSavingTitle}
                onUndo={undo}
                onRedo={redo}
                canUndo={undoStack.length > 1}
                canRedo={redoStack.length > 0}
                formatState={formatState}
                onFormat={handleFormat}
                onShowTableManager={() => setShowTableManager(true)}
                checkIfInsideTable={checkIfInsideTable}
                isAIChatOpen={isAIChatOpen}
                onToggleAIChat={() => setIsAIChatOpen(!isAIChatOpen)}
            />

            {/* Writing Area */}
            <div 
                className="flex-1 overflow-y-auto editor-content transition-all duration-300 ease-in-out"
                style={{ 
                    marginRight: isAIChatOpen ? `${aiChatWidth}px` : '0px',
                    height: 'calc(100vh - 56px)',
                    maxHeight: 'calc(100vh - 56px)'
                }}
            >
                <div className="relative">
                    <div className="p-8 max-w-4xl mx-auto">
                        <div
                            ref={editorRef}
                            contentEditable
                            className="min-h-[600px] focus:outline-none max-w-none relative"
                            style={{
                                color: '#000000',
                                lineHeight: '1.6',
                                fontFamily: 'Arial, sans-serif',
                                fontSize: '16px',
                                margin: 0,
                                padding: 0,
                                minHeight: '0px'
                            }}
                            onInput={handleContentChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            suppressContentEditableWarning={true}
                            role="textbox"
                            aria-label="Rich text editor"
                            aria-multiline="true"
                        />
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="delete-modal-container bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl border border-gray-200 transform transition-all duration-200 scale-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Delete Document</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete "{documentTitle}"? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteDocument}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete Document
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Manager */}
            <TableManager
                isOpen={showTableManager}
                onClose={() => setShowTableManager(false)}
                onInsertTable={insertTable}
            />

            {/* AI Chat Panel */}
            {isAIChatOpen && (
                <div 
                    className="fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out z-40"
                    style={{ width: `${aiChatWidth}px` }}
                >
                    <AIChatPanel
                        isOpen={isAIChatOpen}
                        onClose={() => setIsAIChatOpen(false)}
                        width={aiChatWidth}
                        onWidthChange={setAiChatWidth}
                        documentId={documentId}
                        editorAgent={editorAgent || undefined}
                        editorRef={editorRef}
                        onLiveTypingChange={setIsLiveTyping}
                    />
                </div>
            )}

            {/* Bottom Status Bar */}
            <div className="h-8 border-t border-gray-200 bg-gray-50 px-4 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                    <span>{getWordCount()} words</span>
                    <span>{getCharCount()} characters</span>
                    {isSaving && <span className="text-blue-600">Saving...</span>}
                    {isLiveTyping && (
                        <span className="text-green-600 flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            AI Writing...
                        </span>
                    )}
                    {saveError && (
                        <span className="text-red-600">Save failed</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                        Document ID: {documentId}
                    </span>
                </div>
            </div>

            </div>
        </div>
    )
}
