'use client'
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { FormatState } from "@/types";
import { 
    Bold, Italic, Underline, Strikethrough, 
    List, ListOrdered, Quote, Link2, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Code, Undo2, Redo2,
    Palette, ArrowLeft
} from "lucide-react";

export default function Editor({ documentId, onContentChange }: { documentId: string; onContentChange?: (content: string) => void }) {
    const [content, setContent] = useState('<p>Start writing your document here...</p>')
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
    
    const editorRef = useRef<HTMLDivElement>(null)
    const [undoStack, setUndoStack] = useState<string[]>([])
    const [redoStack, setRedoStack] = useState<string[]>([])
    const [isUndoRedo, setIsUndoRedo] = useState(false)

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

    // Initialize editor content
    useEffect(() => {
        if (editorRef.current && content) {
            editorRef.current.innerHTML = content
            setUndoStack([content])
        }
    }, [])

    // Sync content with parent component
    useEffect(() => {
        onContentChange?.(content)
    }, [content, onContentChange])

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
        
        let element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
        if (!element) return

        const newFormatState: Partial<FormatState> = {}
        
        newFormatState.bold = !!element.closest('strong, b')
        newFormatState.italic = !!element.closest('em, i')
        newFormatState.underline = !!element.closest('u')
        newFormatState.strikethrough = !!element.closest('s, strike')
        newFormatState.subscript = !!element.closest('sub')
        newFormatState.superscript = !!element.closest('sup')
        
        const computedStyle = window.getComputedStyle(element)
        newFormatState.color = computedStyle.color
        newFormatState.backgroundColor = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computedStyle.backgroundColor : 'transparent'
        newFormatState.fontSize = computedStyle.fontSize
        newFormatState.fontFamily = computedStyle.fontFamily
        
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
        
        const headingMatch = element.closest('h1, h2, h3, h4, h5, h6')?.tagName.toLowerCase()
        newFormatState.headingLevel = headingMatch || 'none'
        
        setFormatState(prev => ({ ...prev, ...newFormatState }))
    }, [])

    // Undo functionality
    const undo = useCallback(() => {
        console.log('Undo called. Stack size:', undoStack.length)
        if (undoStack.length > 1) {
            const currentContent = undoStack[undoStack.length - 1]
            const previousContent = undoStack[undoStack.length - 2]
            
            setRedoStack(prev => [...prev, currentContent])
            setUndoStack(prev => prev.slice(0, -1))
            
            if (editorRef.current) {
                setIsUndoRedo(true)
                editorRef.current.innerHTML = previousContent
                setContent(previousContent)
                console.log('Undo applied, content restored')
                // Update format state after undo
                setTimeout(() => {
                    updateFormatState()
                    setIsUndoRedo(false)
                }, 0)
            }
        } else {
            console.log('Cannot undo: stack too small')
        }
    }, [undoStack, updateFormatState])

    // Redo functionality
    const redo = useCallback(() => {
        console.log('Redo called. Stack size:', redoStack.length)
        if (redoStack.length > 0) {
            const nextContent = redoStack[redoStack.length - 1]
            
            setUndoStack(prev => [...prev, nextContent])
            setRedoStack(prev => prev.slice(0, -1))
            
            if (editorRef.current) {
                setIsUndoRedo(true)
                editorRef.current.innerHTML = nextContent
                setContent(nextContent)
                console.log('Redo applied, content restored')
                // Update format state after redo
                setTimeout(() => {
                    updateFormatState()
                    setIsUndoRedo(false)
                }, 0)
            }
        } else {
            console.log('Cannot redo: stack empty')
        }
    }, [redoStack, updateFormatState])

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
                    success = applyInlineFormat('strong', range)
                    break
                case 'italic':
                    success = applyInlineFormat('em', range)
                    break
                case 'underline':
                    success = applyInlineFormat('u', range)
                    break
                case 'strikeThrough':
                    success = applyInlineFormat('s', range)
                    break
                case 'subscript':
                    success = applyInlineFormat('sub', range)
                    break
                case 'superscript':
                    success = applyInlineFormat('sup', range)
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
                        success = applyBlockFormat(value, range)
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
            }
            
            if (success) {
                if (editorRef.current) {
                    const newContent = editorRef.current.innerHTML
                    setContent(newContent)
                }
                updateFormatState()
                editorRef.current?.focus()
            }
            
        } catch (error) {
            console.error('Error applying format:', error)
        }
    }, [saveToUndoStack, updateFormatState])

    // Formatting functions
    const applyInlineFormat = (tagName: string, range: Range): boolean => {
        try {
            const element = document.createElement(tagName)
            range.surroundContents(element)
            return true
        } catch (error) {
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
            }
        }
    }, [handleFormat, undo, redo])

    // Handle content changes from the editor
    const handleContentChange = useCallback(() => {
        if (editorRef.current && !isUndoRedo) {
            const newContent = editorRef.current.innerHTML
            setContent(newContent)
            // Save to undo stack when content changes (but not during undo/redo)
            saveToUndoStack(newContent)
            console.log('Content changed, saved to undo stack. Stack size:', undoStack.length + 1)
        }
    }, [saveToUndoStack, isUndoRedo, undoStack.length])

    // Add selection change listener
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (selection && selection.toString().length > 0) {
                updateFormatState()
            } else {
                // Reset format state when no text is selected
                resetFormatState()
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [])

    const getWordCount = () => {
        const text = content.replace(/<[^>]*>/g, '')
        return text.split(/\s+/).filter(Boolean).length
    }

    const getCharCount = () => {
        return content.replace(/<[^>]*>/g, '').length
    }

    const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']
    const fontFamilies = [
        { name: 'Arial', value: 'Arial, sans-serif' },
        { name: 'Georgia', value: 'Georgia, serif' },
        { name: 'Times', value: 'Times New Roman, serif' },
        { name: 'Courier', value: 'Courier New, monospace' },
        { name: 'Verdana', value: 'Verdana, sans-serif' },
        { name: 'Helvetica', value: 'Helvetica, sans-serif' }
    ]

    return (
        <div className="flex-1 flex flex-col relative">
            {/* Fixed Toolbar - Google Docs Style */}
            <div className="h-14 editor-toolbar flex items-center px-4 gap-2">
                {/* Back Button */}
                <Link href="/home" className="p-2 hover:bg-gray-100 rounded transition-colors mr-2">
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                </Link>
                
                <div className="w-px h-6 bg-gray-300"></div>
                
                {/* Undo/Redo */}
                <div className="flex items-center gap-1 mr-2">
                    <button
                        onClick={undo}
                        disabled={undoStack.length <= 1}
                        className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={redoStack.length === 0}
                        className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo2 className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
                
                <div className="w-px h-6 bg-gray-300"></div>

                {/* Font Family */}
                <select
                    value={fontFamilies.find(f => f.value === formatState.fontFamily)?.value || 'Arial, sans-serif'}
                    onChange={(e) => handleFormat('fontFamily', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {fontFamilies.map((font) => (
                        <option key={font.value} value={font.value}>{font.name}</option>
                    ))}
                </select>

                {/* Font Size */}
                <select
                    value={formatState.fontSize}
                    onChange={(e) => handleFormat('fontSize', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-16"
                >
                    {fontSizes.map((size) => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Text Formatting */}
                <button
                    onClick={() => handleFormat('bold')}
                    className={`p-2 rounded transition-colors ${formatState.bold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('italic')}
                    className={`p-2 rounded transition-colors ${formatState.italic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('underline')}
                    className={`p-2 rounded transition-colors ${formatState.underline ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Underline (Ctrl+U)"
                >
                    <Underline className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('strikeThrough')}
                    className={`p-2 rounded transition-colors ${formatState.strikethrough ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Text Color */}
                <div className="relative">
                    <button
                        onClick={() => {
                            const color = prompt('Enter color (e.g., #000000, red, blue):', formatState.color)
                            if (color) handleFormat('foreColor', color)
                        }}
                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                        title="Text Color"
                    >
                        <Palette className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Headings */}
                <button
                    onClick={() => handleFormat('formatBlock', 'h1')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h1' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Heading 1"
                >
                    H1
                </button>
                <button
                    onClick={() => handleFormat('formatBlock', 'h2')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h2' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Heading 2"
                >
                    H2
                </button>
                <button
                    onClick={() => handleFormat('formatBlock', 'h3')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h3' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Heading 3"
                >
                    H3
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Lists */}
                <button
                    onClick={() => handleFormat('insertUnorderedList')}
                    className={`p-2 rounded transition-colors ${formatState.listType === 'unordered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('insertOrderedList')}
                    className={`p-2 rounded transition-colors ${formatState.listType === 'ordered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Numbered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Alignment */}
                <button
                    onClick={() => handleFormat('justifyLeft')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Align Left"
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('justifyCenter')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Align Center"
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('justifyRight')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Align Right"
                >
                    <AlignRight className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('justifyFull')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'justify' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Justify"
                >
                    <AlignJustify className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Special Formats */}
                <button
                    onClick={() => handleFormat('formatBlock', 'blockquote')}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Quote Block"
                >
                    <Quote className="w-4 h-4 text-gray-600" />
                </button>
                <button
                    onClick={() => handleFormat('formatBlock', 'pre')}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Code Block"
                >
                    <Code className="w-4 h-4 text-gray-600" />
                </button>
                <button
                    onClick={() => handleFormat('createLink')}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Insert Link (Ctrl+K)"
                >
                    <Link2 className="w-4 h-4 text-gray-600" />
                </button>
            </div>

            {/* Writing Area */}
            <div className="flex-1 overflow-y-auto editor-content">
                <div className="max-w-4xl mx-auto p-8">
                    <div
                        ref={editorRef}
                        contentEditable
                        className="min-h-[600px] focus:outline-none max-w-none"
                        style={{
                            color: '#000000',
                            lineHeight: '1.6',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '16px'
                        }}
                        onInput={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onClick={() => {
                            const selection = window.getSelection()
                            if (!selection || selection.toString().length === 0) {
                                // Reset format state when clicking in empty areas
                                resetFormatState()
                            }
                        }}
                        onBlur={() => {
                            // Reset format state when editor loses focus
                            setTimeout(() => {
                                const selection = window.getSelection()
                                if (!selection || selection.toString().length === 0) {
                                    resetFormatState()
                                }
                            }, 100)
                        }}
                        suppressContentEditableWarning={true}
                        role="textbox"
                        aria-label="Rich text editor"
                        aria-multiline="true"
                    />
                </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="h-8 border-t border-gray-200 bg-gray-50 px-4 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                    <span>{getWordCount()} words</span>
                    <span>{getCharCount()} characters</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                        Document ID: {documentId}
                    </span>
                </div>
            </div>
        </div>
    )
}

