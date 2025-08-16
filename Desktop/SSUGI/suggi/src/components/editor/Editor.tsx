'use client'
import { useState, useRef, useEffect, useCallback } from "react";
import Toolbar from "./Toolbar";
import { FormatState } from "@/types";

export default function Editor({ documentId, onContentChange }: { documentId: string; onContentChange?: (content: string) => void }) {
    const [content, setContent] = useState(`
        <h1>Welcome to Suggi</h1>
        <p>Start writing your thoughts here...</p>
    `)
    const [showToolbar, setShowToolbar] = useState(false)
    const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
    const [formatState, setFormatState] = useState<FormatState>({
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        subscript: false,
        superscript: false,
        color: '#2C2416',
        backgroundColor: 'transparent',
        fontSize: '16px',
        fontFamily: 'Georgia, serif',
        alignment: 'left',
        listType: 'none',
        headingLevel: 'none'
    })
    
    const editorRef = useRef<HTMLDivElement>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [undoStack, setUndoStack] = useState<string[]>([])
    const [redoStack, setRedoStack] = useState<string[]>([])

    // Sync content with parent component
    useEffect(() => {
        if (isInitialized) {
            onContentChange?.(content)
        }
    }, [content, onContentChange, isInitialized])

    // Initialize editor content
    useEffect(() => {
        if (editorRef.current && !isInitialized) {
            editorRef.current.innerHTML = content
            setIsInitialized(true)
            setUndoStack([content])
        }
    }, [content, isInitialized])

    // Save content to undo stack
    const saveToUndoStack = useCallback((newContent: string) => {
        setUndoStack(prev => [...prev, newContent].slice(-50)) // Keep last 50 states
        setRedoStack([]) // Clear redo stack when new content is added
    }, [])

    // Undo functionality
    const undo = useCallback(() => {
        if (undoStack.length > 1) {
            const currentContent = undoStack[undoStack.length - 1]
            const previousContent = undoStack[undoStack.length - 2]
            
            setRedoStack(prev => [...prev, currentContent])
            setUndoStack(prev => prev.slice(0, -1))
            
            if (editorRef.current) {
                editorRef.current.innerHTML = previousContent
                setContent(previousContent)
            }
        }
    }, [undoStack])

    // Redo functionality
    const redo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextContent = redoStack[redoStack.length - 1]
            
            setUndoStack(prev => [...prev, nextContent])
            setRedoStack(prev => prev.slice(0, -1))
            
            if (editorRef.current) {
                editorRef.current.innerHTML = nextContent
                setContent(nextContent)
            }
        }
    }, [redoStack])

    // Update format state based on current selection
    const updateFormatState = useCallback(() => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        const container = range.commonAncestorContainer
        
        // Find the closest formatting element
        let element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
        if (!element) return

        // Check formatting state
        const newFormatState: Partial<FormatState> = {}
        
        newFormatState.bold = !!element.closest('strong, b')
        newFormatState.italic = !!element.closest('em, i')
        newFormatState.underline = !!element.closest('u')
        newFormatState.strikethrough = !!element.closest('s, strike')
        newFormatState.subscript = !!element.closest('sub')
        newFormatState.superscript = !!element.closest('sup')
        
        // Check color and background
        const computedStyle = window.getComputedStyle(element)
        newFormatState.color = computedStyle.color
        newFormatState.backgroundColor = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computedStyle.backgroundColor : 'transparent'
        newFormatState.fontSize = computedStyle.fontSize
        newFormatState.fontFamily = computedStyle.fontFamily
        
        // Check alignment
        if (element.closest('p, div, h1, h2, h3, h4, h5, h6')) {
            const blockElement = element.closest('p, div, h1, h2, h3, h4, h5, h6') as Element
            const textAlign = window.getComputedStyle(blockElement).textAlign
            newFormatState.alignment = textAlign
        }
        
        // Check list type
        if (element.closest('ul')) {
            newFormatState.listType = 'unordered'
        } else if (element.closest('ol')) {
            newFormatState.listType = 'ordered'
        } else {
            newFormatState.listType = 'none'
        }
        
        // Check heading level
        const headingMatch = element.closest('h1, h2, h3, h4, h5, h6')?.tagName.toLowerCase()
        newFormatState.headingLevel = headingMatch || 'none'
        
        setFormatState(prev => ({ ...prev, ...newFormatState }))
    }, [])

    const handleTextSelection = useCallback(() => {
        console.log('=== handleTextSelection called ===')
        const selection = window.getSelection()
        console.log('Selection object:', selection)
        console.log('Selection text:', selection?.toString())
        console.log('Selection range count:', selection?.rangeCount)
        
        if (selection && selection.toString().length > 0) {
            console.log('Text selected, showing toolbar')
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            const editorRect = editorRef.current?.getBoundingClientRect()
            
            console.log('Selection rect:', rect)
            console.log('Editor rect:', editorRect)
            
            if (editorRect) {
                const newPosition = {
                    top: rect.top - 60,
                    left: Math.min(
                        Math.max(rect.left + rect.width / 2, 100),
                        window.innerWidth - 100
                    ),
                }
                console.log('Setting toolbar position:', newPosition)
                setToolbarPosition(newPosition)
                setShowToolbar(true)
            }
            
            updateFormatState()
        } else {
            console.log('No text selected, hiding toolbar')
            setShowToolbar(false)
        }
    }, [updateFormatState])

    const handleFormat = useCallback((command: string, value?: string) => {
        console.log('=== handleFormat called ===')
        console.log('Command:', command, 'Value:', value)
        
        const selection = window.getSelection()
        console.log('Current selection:', selection?.toString())
        console.log('Selection range count:', selection?.rangeCount)
        
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found, returning')
            return
        }

        const range = selection.getRangeAt(0)
        if (!range) {
            console.log('No range found, returning')
            return
        }

        console.log('Range found, applying format:', command)

        // Save current state for undo
        if (editorRef.current) {
            saveToUndoStack(editorRef.current.innerHTML)
        }

        try {
            let success = false
            
            switch (command) {
                case 'bold':
                    console.log('Applying bold format')
                    success = applyInlineFormat('strong', range)
                    break
                case 'italic':
                    console.log('Applying italic format')
                    success = applyInlineFormat('em', range)
                    break
                case 'underline':
                    console.log('Applying underline format')
                    success = applyInlineFormat('u', range)
                    break
                case 'strikeThrough':
                    console.log('Applying strikethrough format')
                    success = applyInlineFormat('s', range)
                    break
                case 'subscript':
                    console.log('Applying subscript format')
                    success = applyInlineFormat('sub', range)
                    break
                case 'superscript':
                    console.log('Applying superscript format')
                    success = applyInlineFormat('sup', range)
                    break
                case 'insertUnorderedList':
                    console.log('Applying unordered list format')
                    success = applyListFormat('ul', range)
                    break
                case 'insertOrderedList':
                    console.log('Applying ordered list format')
                    success = applyListFormat('ol', range)
                    break
                case 'justifyLeft':
                    console.log('Applying left alignment')
                    success = applyAlignment('left', range)
                    break
                case 'justifyCenter':
                    console.log('Applying center alignment')
                    success = applyAlignment('center', range)
                    break
                case 'justifyRight':
                    console.log('Applying right alignment')
                    success = applyAlignment('right', range)
                    break
                case 'justifyFull':
                    console.log('Applying justify alignment')
                    success = applyAlignment('justify', range)
                    break
                case 'formatBlock':
                    if (value) {
                        console.log('Applying block format:', value)
                        success = applyBlockFormat(value, range)
                    }
                    break
                case 'createLink':
                    if (value) {
                        console.log('Creating link:', value)
                        success = applyLinkFormat(value, range)
                    }
                    break
                case 'backColor':
                    if (value) {
                        console.log('Applying background color:', value)
                        success = applyBackgroundColor(value, range)
                    }
                    break
                case 'foreColor':
                    if (value) {
                        console.log('Applying text color:', value)
                        success = applyTextColor(value, range)
                    }
                    break
                case 'fontSize':
                    if (value) {
                        console.log('Applying font size:', value)
                        success = applyFontSize(value, range)
                    }
                    break
                case 'fontFamily':
                    if (value) {
                        console.log('Applying font family:', value)
                        success = applyFontFamily(value, range)
                    }
                    break
                default:
                    console.log('Unknown command:', command)
                    return
            }
            
            console.log('Format result:', success)
            
            if (success) {
                // Update content state after formatting
                if (editorRef.current) {
                    const newContent = editorRef.current.innerHTML
                    console.log('Content updated, new content length:', newContent.length)
                    setContent(newContent)
                }
                
                // Update format state
                updateFormatState()
                
                // Hide toolbar after formatting
                setShowToolbar(false)
                
                // Focus back to editor
                editorRef.current?.focus()
            }
            
        } catch (error) {
            console.error('Error applying format:', error)
        }
    }, [saveToUndoStack, updateFormatState])

    // Modern formatting functions
    const applyInlineFormat = (tagName: string, range: Range): boolean => {
        try {
            const element = document.createElement(tagName)
            range.surroundContents(element)
            return true
        } catch (error) {
            // If surroundContents fails, try a different approach
            try {
                const element = document.createElement(tagName)
                const fragment = range.extractContents()
                element.appendChild(fragment)
                range.insertNode(element)
                return true
            } catch (innerError) {
                console.error('Failed to apply inline format:', innerError)
                return false
            }
        }
    }

    const applyBlockFormat = (tagName: string, range: Range): boolean => {
        try {
            const element = document.createElement(tagName)
            const fragment = range.extractContents()
            element.appendChild(fragment)
            range.insertNode(element)
            return true
        } catch (error) {
            console.error('Failed to apply block format:', error)
            return false
        }
    }

    const applyListFormat = (listType: string, range: Range): boolean => {
        try {
            const list = document.createElement(listType)
            const listItem = document.createElement('li')
            const fragment = range.extractContents()
            listItem.appendChild(fragment)
            list.appendChild(listItem)
            range.insertNode(list)
            return true
        } catch (error) {
            console.error('Failed to apply list format:', error)
            return false
        }
    }

    const applyAlignment = (alignment: string, range: Range): boolean => {
        try {
            const blockElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
                ? range.commonAncestorContainer as Element 
                : range.commonAncestorContainer.parentElement
            
            if (blockElement) {
                const targetBlock = blockElement.closest('p, div, h1, h2, h3, h4, h5, h6')
                if (targetBlock) {
                    (targetBlock as HTMLElement).style.textAlign = alignment
                    return true
                }
            }
            return false
        } catch (error) {
            console.error('Failed to apply alignment:', error)
            return false
        }
    }

    const applyLinkFormat = (url: string, range: Range): boolean => {
        try {
            const link = document.createElement('a')
            link.href = url
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
            const fragment = range.extractContents()
            link.appendChild(fragment)
            range.insertNode(link)
            return true
        } catch (error) {
            console.error('Failed to apply link format:', error)
            return false
        }
    }

    const applyBackgroundColor = (color: string, range: Range): boolean => {
        try {
            const mark = document.createElement('mark')
            mark.style.backgroundColor = color
            range.surroundContents(mark)
            return true
        } catch (error) {
            console.error('Failed to apply background color:', error)
            return false
        }
    }

    const applyTextColor = (color: string, range: Range): boolean => {
        try {
            const span = document.createElement('span')
            span.style.color = color
            range.surroundContents(span)
            return true
        } catch (error) {
            console.error('Failed to apply text color:', error)
            return false
        }
    }

    const applyFontSize = (size: string, range: Range): boolean => {
        try {
            const span = document.createElement('span')
            span.style.fontSize = size
            range.surroundContents(span)
            return true
        } catch (error) {
            console.error('Failed to apply font size:', error)
            return false
        }
    }

    const applyFontFamily = (family: string, range: Range): boolean => {
        try {
            const span = document.createElement('span')
            span.style.fontFamily = family
            range.surroundContents(span)
            return true
        } catch (error) {
            console.error('Failed to apply font family:', error)
            return false
        }
    }

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const isCtrl = e.ctrlKey || e.metaKey
        const isShift = e.shiftKey

        if (isCtrl) {
            switch (e.key.toLowerCase()) {
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
                case 'q':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('formatBlock', 'blockquote')
                    }
                    break
                case 'k':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('formatBlock', 'pre')
                    }
                    break
                case 'h':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('backColor', 'yellow')
                    }
                    break
                case '=':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('superscript')
                    } else {
                        e.preventDefault()
                        handleFormat('subscript')
                    }
                    break
                case 'x':
                    if (isShift) {
                        e.preventDefault()
                        handleFormat('strikeThrough')
                    }
                    break
            }
        }
    }, [handleFormat, undo, redo])

    // Handle content changes from the editor
    const handleContentChange = useCallback(() => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML
            setContent(newContent)
        }
    }, [])

    // Add selection change listener
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (selection && selection.toString().length > 0) {
                updateFormatState()
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [updateFormatState])

    // Hide toolbar when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element
            
            if (target.closest('.toolbar-container')) {
                return
            }
            
            if (editorRef.current && editorRef.current.contains(target)) {
                return
            }
            
            setShowToolbar(false)
        }
        
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Debug logging
    useEffect(() => {
        console.log('Editor state changed:', {
            showToolbar,
            toolbarPosition,
            formatState,
            undoStackLength: undoStack.length,
            redoStackLength: redoStack.length
        })
    }, [showToolbar, toolbarPosition, formatState, undoStack.length, redoStack.length])

    const getWordCount = () => {
        const text = content.replace(/<[^>]*>/g, '')
        return text.split(/\s+/).filter(Boolean).length
    }

    const getCharCount = () => {
        return content.replace(/<[^>]*>/g, '').length
    }

    const getParagraphCount = () => {
        const paragraphs = content.match(/<p[^>]*>.*?<\/p>/g) || []
        return paragraphs.length
    }

    return (
        <div className="flex-1 flex flex-col relative">
            {/* Floating Toolbar */}
            {showToolbar && (
                <Toolbar
                    position={toolbarPosition}
                    onFormat={handleFormat}
                    formatState={formatState}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={undoStack.length > 1}
                    canRedo={redoStack.length > 0}
                />
            )}

            {/* Writing Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <div
                        ref={editorRef}
                        contentEditable
                        className="prose prose-lg max-w-none focus:outline-none min-h-[600px] p-6 border border-brown-light/20 rounded-lg bg-white"
                        style={{
                            color: '#2C2416',
                            lineHeight: '1.8',
                            fontFamily: 'Georgia, serif',
                        }}
                        onInput={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onMouseUp={handleTextSelection}
                        onKeyUp={handleTextSelection}
                        onBlur={() => setShowToolbar(false)}
                        suppressContentEditableWarning={true}
                        role="textbox"
                        aria-label="Rich text editor"
                        aria-multiline="true"
                    />
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="h-12 border-t border-brown-light/20 bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between text-sm text-ink/60">
                <div className="flex items-center gap-6">
                    <span>{getWordCount()} words</span>
                    <span>{getCharCount()} characters</span>
                    <span>{getParagraphCount()} paragraphs</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={undo}
                        disabled={undoStack.length <= 1}
                        className="px-3 py-1 text-xs bg-stone-light hover:bg-brown-light/20 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                        title="Undo (Ctrl+Z)"
                    >
                        Undo
                    </button>
                    <button
                        onClick={redo}
                        disabled={redoStack.length === 0}
                        className="px-3 py-1 text-xs bg-stone-light hover:bg-brown-light/20 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        Redo
                    </button>
                    <span className="text-xs text-ink/40">
                        Document ID: {documentId}
                    </span>
                </div>
            </div>
        </div>
    )
}

