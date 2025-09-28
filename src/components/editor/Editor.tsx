'use client'
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormatState } from "@/types";
import { 
    Bold, Italic, Underline, Strikethrough, 
    List, ListOrdered, Quote, Link2, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Code, Undo2, Redo2,
    Palette, ArrowLeft, Save, Trash2, Feather, Check, Table
} from "lucide-react";
import AIChatPanel from './AIChatPanel';
import TableManager, { TableContextMenu } from './TableManager';
import './table-styles.css';

export default function Editor({ 
  documentId, 
  onContentChange
}: { 
  documentId: string; 
  onContentChange?: (content: string) => void;
}) {
    const [content, setContent] = useState('<p>Start writing your document here...</p>')
    const [originalContent, setOriginalContent] = useState('')
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
    const isUpdatingContentRef = useRef(false)
    const [undoStack, setUndoStack] = useState<string[]>([])
    const [redoStack, setRedoStack] = useState<string[]>([])
    const [isUndoRedo, setIsUndoRedo] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const colorPickerRef = useRef<HTMLDivElement>(null)
    const [documentTitle, setDocumentTitle] = useState('Untitled Document')
    
    const [originalTitle, setOriginalTitle] = useState('Untitled Document')
    
    // User typing state
    const [isUserTyping, setIsUserTyping] = useState(false)
    const [lastUserTypingTime, setLastUserTypingTime] = useState<Date | null>(null)
    
    // Agent typing state - prevents auto-save during agent typing
    const [isAgentTyping, setIsAgentTyping] = useState(false)
    
    // Functions to control agent typing state
    const startAgentTyping = useCallback(() => {
        setIsAgentTyping(true)
        setIsUserTyping(false) // Prevent user typing detection
    }, [])
    
    const stopAgentTyping = useCallback(() => {
        setIsAgentTyping(false)
        // Re-enable user typing detection
        setIsUserTyping(true)
        setLastUserTypingTime(new Date())
    }, [])
    
    
    
    
    
    
    
    // Expose document content getter to parent components
    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined') return
        
        // Safely set window properties
        try {
            ;(window as any).getCurrentDocumentContent = () => {
                return editorRef.current?.innerText || ''
            }
        } catch (error) {
            console.warn('Failed to set window properties:', error)
        }
    }, [])
    const [isSavingTitle, setIsSavingTitle] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [justSaved, setJustSaved] = useState(false)
    
    // AI Chat Panel state
    const [isAIChatOpen, setIsAIChatOpen] = useState(false)
    const [aiChatWidth, setAiChatWidth] = useState(400)
    
    // Table state
    const [showTableManager, setShowTableManager] = useState(false)
    const [isInsideTable, setIsInsideTable] = useState(false)
    const [tableContextMenu, setTableContextMenu] = useState<{
        isOpen: boolean;
        position: { x: number; y: number };
        tableElement?: HTMLTableElement;
        cellElement?: HTMLTableCellElement;
    }>({
        isOpen: false,
        position: { x: 0, y: 0 }
    })
    
    // Simple resize state
    const [isResizingColumn, setIsResizingColumn] = useState(false)
    const [isResizingRow, setIsResizingRow] = useState(false)
    const [columnResizeData, setColumnResizeData] = useState<{
        startX: number;
        startWidth: number;
        cell: HTMLElement | null;
    }>({
        startX: 0,
        startWidth: 0,
        cell: null
    })
    const [rowResizeData, setRowResizeData] = useState<{
        startY: number;
        startHeight: number;
        cell: HTMLElement | null;
    }>({
        startY: 0,
        startHeight: 0,
        cell: null
    })
    
    const router = useRouter()
    
    // Image editing state
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)

    // Prevent hydration mismatch by only running on client
    useEffect(() => {
        setMounted(true)
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

    // Initialize editor content
    useEffect(() => {
        if (!mounted) return
        
        console.log('Initializing editor with documentId:', documentId)
        
        if (documentId === 'new') {
            // For new documents, use default content
            console.log('Setting up new document')
            setDocumentTitle('Untitled Document')
            setOriginalTitle('Untitled Document')
            if (editorRef.current) {
                editorRef.current.innerHTML = content
                setUndoStack([content])
                setOriginalContent(content)
            }
        } else {
            // Load existing document content
            loadDocumentContent()
        }
    }, [documentId, mounted])

    // Load document content from API
    const loadDocumentContent = useCallback(async () => {
        if (!mounted) return
        
        console.log('📥 Loading document content for ID:', documentId)
        
        try {
            setIsLoading(true)
            const response = await fetch(`/api/documents/${documentId}`)
            
            console.log('📥 API response status:', response.status)
            
            if (response.ok) {
                const document = await response.json()
                console.log('📥 Document loaded from API:', {
                    id: document.id,
                    title: document.title,
                    hasContent: !!document.content,
                    contentType: typeof document.content
                })
                
                // Handle content that might be JSON or string
                let documentContent = '<p>Start writing your document here...</p>'
                if (document.content) {
                    console.log('🔍 Loading document content:', {
                        contentType: typeof document.content,
                        content: document.content,
                        hasHtml: document.content?.html ? 'yes' : 'no',
                        hasPlainText: document.content?.plainText ? 'yes' : 'no'
                    })
                    
                    if (typeof document.content === 'string') {
                        // Legacy string content
                        documentContent = document.content
                    } else if (typeof document.content === 'object' && document.content !== null) {
                        // Modern JSON content structure
                        if (document.content.html) {
                        documentContent = document.content.html
                        } else if (document.content.plainText) {
                            // If no HTML but we have plain text, wrap it in a paragraph
                            documentContent = `<p>${document.content.plainText}</p>`
                        } else {
                            // Fallback for unexpected object structure
                            documentContent = '<p>Start writing your document here...</p>'
                        }
                    }
                }
                
                console.log('📄 Final document content to display:', documentContent)
                
                // If we still don't have valid HTML, use default content
                if (!documentContent || documentContent === '{}' || documentContent === 'null' || documentContent === 'undefined' || documentContent.trim() === '') {
                    documentContent = '<p>Start writing your document here...</p>'
                }
                
                console.log('📝 Setting editor content:', documentContent)
                setContent(documentContent)
                setOriginalContent(documentContent)
                setUndoStack([documentContent])
                
                // Set document title with proper fallback
                const title = document.title && document.title.trim() !== '' 
                    ? document.title.trim() 
                    : 'Untitled Document'
                setDocumentTitle(title)
                setOriginalTitle(title)
                
                if (editorRef.current) {
                    editorRef.current.innerHTML = documentContent
                }
            } else {
                // Use default content if loading fails
                if (editorRef.current) {
                    editorRef.current.innerHTML = content
                    setUndoStack([content])
                    setOriginalContent(content)
                }
            }
        } catch (error) {
            // Use default content if loading fails
            if (editorRef.current) {
                editorRef.current.innerHTML = content
                setUndoStack([content])
                setOriginalContent(content)
            }
        } finally {
            setIsLoading(false)
        }
    }, [documentId, content, mounted])

    // Ensure editor content is synchronized after loading
    useEffect(() => {
        
        if (mounted && editorRef.current && content && content !== '<p>Start writing your document here...</p>') {
            // Only update if the content is different from the default
            if (editorRef.current.innerHTML !== content) {
                
                // Add a small delay to ensure the editor is fully initialized
                setTimeout(() => {
                    if (editorRef.current) {
                editorRef.current.innerHTML = content
                    }
                }, 100)
            } else {
            }
        } else {
        }
    }, [content, mounted])

    // Sync content with parent component
    useEffect(() => {
        // Only call onContentChange if content is not empty, different from original, and we're not currently updating
        if (content && content !== originalContent && !isUpdatingContentRef.current) {
            onContentChange?.(content)
        }
    }, [content, onContentChange, originalContent])

    // Check for unsaved changes (content and title)
    useEffect(() => {
        if (documentId !== 'new') {
            const hasContentChanges = originalContent !== content
            const hasTitleChanges = documentTitle.trim() !== originalTitle.trim()
            const hasChanges = hasContentChanges || hasTitleChanges
            setHasUnsavedChanges(hasChanges)
            
            // Clear justSaved state when user makes changes
            if (hasChanges && justSaved) {
                setJustSaved(false)
            }
        } else {
            setHasUnsavedChanges(false)
        }
    }, [content, originalContent, documentId, documentTitle, originalTitle, justSaved])

    // Close modals when clicking outside
    useEffect(() => {
        if (!mounted) return
        
        const handleClickOutside = (event: MouseEvent) => {
            if (showDeleteConfirm && !(event.target as Element).closest('.delete-modal-container')) {
                setShowDeleteConfirm(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showDeleteConfirm, mounted])

    // Save document function
    const saveDocument = useCallback(async (contentToSave: string, showSuccessMessage = true) => {
        if (documentId === 'new') return // Don't save for new documents
        
        try {
            setIsSaving(true)
            setSaveError(null)
            
            
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: documentTitle.trim(),
                    content: {
                        html: contentToSave,
                        plainText: contentToSave.replace(/<[^>]*>/g, ''),
                        wordCount: contentToSave.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
                    },
                    plainText: contentToSave.replace(/<[^>]*>/g, ''),
                    wordCount: contentToSave.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
                })
            })

            if (response.ok) {
                const updatedDoc = await response.json()
                setLastSaved(new Date())
                setOriginalContent(contentToSave)
                setOriginalTitle(documentTitle.trim())
                setHasUnsavedChanges(false)
                
                if (showSuccessMessage) {
                    // Show blue feedback for manual saves
                    setJustSaved(true)
                    setTimeout(() => {
                        setJustSaved(false)
                    }, 2000)
                }
            } else {
                const errorData = await response.json()
                throw new Error(errorData.error || `Failed to save document (${response.status})`)
            }
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save document')
            
            // Clear error after 5 seconds
            setTimeout(() => {
                setSaveError(null)
            }, 5000)
        } finally {
            setIsSaving(false)
        }
    }, [documentId, documentTitle])

    // Auto-save content periodically - only for user writings
    useEffect(() => {
        if (!mounted || documentId === 'new' || !hasUnsavedChanges || !isUserTyping) return
        
        const autoSaveTimer = setTimeout(() => {
            if (hasUnsavedChanges && content !== originalContent && isUserTyping) {
                saveDocument(content, false)
            }
        }, 3000) // Auto-save every 3 seconds if there are unsaved changes and user is typing
        
        return () => clearTimeout(autoSaveTimer)
    }, [content, originalContent, hasUnsavedChanges, documentId, mounted, saveDocument, isUserTyping])

    // Manual save function
    const handleManualSave = useCallback(async () => {
        if (documentId === 'new') return
        
        const contentToSave = editorRef.current?.innerHTML || content
        await saveDocument(contentToSave, true)
    }, [documentId, content, saveDocument])

    // Handle navigation directly without warnings
    const handleNavigation = useCallback((url: string) => {
        router.push(url)
    }, [router])

    // Delete document function
    const handleDeleteDocument = useCallback(async () => {
        if (documentId === 'new') return
        
        try {
            setIsDeleting(true)
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            if (response.ok) {
                // Redirect to home page after successful deletion
                router.push('/home')
            } else {
                const errorData = await response.json()
                // You could show an error toast here
            }
        } catch (error) {
            // You could show an error toast here
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }, [documentId, router])

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
        
        // Check if the cursor is in a heading or paragraph, or if the selection spans one
        let headingLevel = 'none'
        
        if (range.collapsed) {
            // Cursor position - check current element
            const headingElement = element.closest('h1, h2, h3, h4, h5, h6')
            if (headingElement) {
                headingLevel = headingElement.tagName.toLowerCase()
            } else {
                // Check if cursor is in a paragraph
                const paragraphElement = element.closest('p')
                if (paragraphElement) {
                    headingLevel = 'p'
                }
            }
        } else {
            // Text selection - check if all selected text is in the same block format
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
                // Update format state after undo
                setTimeout(() => {
                    updateFormatState()
                    setIsUndoRedo(false)
                }, 0)
            }
        }
    }, [undoStack, updateFormatState])

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
                // Update format state after redo
                setTimeout(() => {
                    updateFormatState()
                    setIsUndoRedo(false)
                }, 0)
            }
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
                    // Show the table manager instead of directly inserting
                    console.log('insertTable command triggered')
                    setShowTableManager(true)
                    success = true
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
    const toggleInlineFormat = (tagName: string, range: Range): boolean => {
        try {
            // First, try using the browser's built-in execCommand for reliable toggling
            const selection = window.getSelection()
            if (selection) {
                // Restore the selection to the range
                selection.removeAllRanges()
                selection.addRange(range)
                
                // Map tag names to execCommand commands
                const commandMap: { [key: string]: string } = {
                    'strong': 'bold',
                    'b': 'bold',
                    'em': 'italic',
                    'i': 'italic',
                    'u': 'underline',
                    's': 'strikeThrough',
                    'strike': 'strikeThrough',
                    'sub': 'subscript',
                    'sup': 'superscript'
                }
                
                const command = commandMap[tagName]
                if (command) {
                    const success = document.execCommand(command, false)
                    if (success) {
                        // Update the range to reflect the new selection
                        if (selection.rangeCount > 0) {
                            range.setStart(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset)
                            range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset)
                        }
                        return true
                    }
                }
            }
            
            // Fallback to manual DOM manipulation if execCommand fails
            return toggleInlineFormatManual(tagName, range)
        } catch (error) {
            console.error('Failed to toggle inline format:', error)
            return false
        }
    }

    const toggleInlineFormatManual = (tagName: string, range: Range): boolean => {
        try {
            // Create a range that covers the entire selection
            const selectionRange = range.cloneRange()
            
            // Check if the entire selection is already wrapped in the target tag
            let allFormatted = true
            let formattingElement: Element | null = null
            
            // Get all text nodes in the range using a more reliable method
            const textNodes: Text[] = []
            const startContainer = selectionRange.startContainer
            const endContainer = selectionRange.endContainer
            
            // Handle case where start and end are the same text node
            if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
                textNodes.push(startContainer as Text)
            } else {
                // Walk through the DOM tree to find all text nodes in the range
                const walker = document.createTreeWalker(
                    selectionRange.commonAncestorContainer,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            if (selectionRange.intersectsNode(node)) {
                                textNodes.push(node as Text)
                            }
                            return NodeFilter.FILTER_ACCEPT
                        }
                    }
                )
                
                // Collect all text nodes
                while (walker.nextNode()) {
                    // Text nodes are already collected in the acceptNode callback
                }
            }
            
            // Check if all text nodes have the same formatting parent
            for (const textNode of textNodes) {
                const parent = textNode.parentElement
                if (!parent) continue
                
                const formatParent = parent.closest(tagName)
                if (!formatParent) {
                    allFormatted = false
                    break
                }
                
                if (!formattingElement) {
                    formattingElement = formatParent
                } else if (formattingElement !== formatParent) {
                    allFormatted = false
                    break
                }
            }
            
            if (allFormatted && formattingElement) {
                // The entire selection is wrapped in the same tag, so remove it
                return removeInlineFormat(tagName, formattingElement, selectionRange)
            } else {
                // Apply the formatting
                return applyInlineFormatManual(tagName, selectionRange)
            }
        } catch (error) {
            console.error('Failed to toggle inline format manually:', error)
            return false
        }
    }

    const removeInlineFormat = (tagName: string, formattingElement: Element, range: Range): boolean => {
        try {
            // Create a new range that covers the entire formatting element
            const elementRange = document.createRange()
            elementRange.selectNodeContents(formattingElement)
            
            // Extract the contents
            const contents = elementRange.extractContents()
            
            // Insert the contents before the formatting element
            formattingElement.parentNode?.insertBefore(contents, formattingElement)
            
            // Remove the formatting element
            formattingElement.parentNode?.removeChild(formattingElement)
            
            // Restore the selection to the extracted contents
            range.selectNodeContents(contents)
            return true
        } catch (error) {
            console.error('Failed to remove inline format:', error)
            return false
        }
    }

    const applyInlineFormatManual = (tagName: string, range: Range): boolean => {
        try {
            const element = document.createElement(tagName)
            
            try {
                range.surroundContents(element)
            } catch (error) {
                // If surroundContents fails, use extractContents approach
                const fragment = range.extractContents()
                element.appendChild(fragment)
                range.insertNode(element)
            }
            return true
        } catch (error) {
            console.error('Failed to apply inline format manually:', error)
            return false
        }
    }

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

    const toggleBlockFormat = (tagName: string, range: Range): boolean => {
        try {
            // Check if we have a text selection or just cursor position
            const hasSelection = range.toString().length > 0
            
            if (hasSelection) {
                // Handle text selection - wrap the selected text in the new block format
                return applyBlockFormatToSelection(tagName, range)
            } else {
                // Handle cursor position - convert the current block
                return convertCurrentBlock(tagName, range)
            }
        } catch (error) {
            console.error('Failed to toggle block format:', error)
            return false
        }
    }

    const applyBlockFormatToSelection = (tagName: string, range: Range): boolean => {
        try {
            // Check if the selection is within a single block element
            const startContainer = range.startContainer
            const endContainer = range.endContainer
            
            // Find the block elements at start and end
            const startBlock = startContainer.nodeType === Node.ELEMENT_NODE 
                ? (startContainer as Element).closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre')
                : startContainer.parentElement?.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre')
            
            const endBlock = endContainer.nodeType === Node.ELEMENT_NODE 
                ? (endContainer as Element).closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre')
                : endContainer.parentElement?.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre')
            
            if (startBlock && endBlock && startBlock === endBlock) {
                // Selection is within a single block - handle partial selection properly
                return handlePartialBlockSelection(tagName, startBlock, range)
            } else {
                // Selection spans multiple blocks - wrap the selection
                return wrapSelectionInBlock(tagName, range)
            }
        } catch (error) {
            console.error('Failed to apply block format to selection:', error)
            return false
        }
    }

    const handlePartialBlockSelection = (tagName: string, blockElement: Element, range: Range): boolean => {
        try {
            // Check if the block is already the target format
            if (blockElement.tagName.toLowerCase() === tagName.toLowerCase()) {
                // Convert to paragraph
                const paragraph = document.createElement('p')
                while (blockElement.firstChild) {
                    paragraph.appendChild(blockElement.firstChild)
                }
                blockElement.parentNode?.replaceChild(paragraph, blockElement)
                range.selectNodeContents(paragraph)
                return true
            } else {
                // For partial selection, we need to split the block and apply formatting to the selected portion
                return splitBlockAndApplyFormat(tagName, blockElement, range)
            }
        } catch (error) {
            console.error('Failed to handle partial block selection:', error)
            return false
        }
    }

    const splitBlockAndApplyFormat = (tagName: string, blockElement: Element, range: Range): boolean => {
        try {
            const parent = blockElement.parentNode
            if (!parent) return false

            // Clone the original block to preserve its attributes and styling
            const originalTagName = blockElement.tagName.toLowerCase()
            
            // Create before block (if there's content before selection)
            let beforeBlock: Element | null = null
            if (range.startOffset > 0 || range.startContainer !== blockElement.firstChild) {
                beforeBlock = document.createElement(originalTagName)
                const beforeRange = document.createRange()
                beforeRange.setStart(blockElement, 0)
                beforeRange.setEnd(range.startContainer, range.startOffset)
                const beforeContent = beforeRange.extractContents()
                if (beforeContent.textContent?.trim()) {
                    beforeBlock.appendChild(beforeContent)
                    parent.insertBefore(beforeBlock, blockElement)
                }
            }

            // Create new formatted block for selected content
            const selectedContent = range.extractContents()
            const newBlock = document.createElement(tagName)
            newBlock.appendChild(selectedContent)
            parent.insertBefore(newBlock, blockElement)

            // Create after block (if there's content after selection)
            let afterBlock: Element | null = null
            if (range.endOffset < blockElement.childNodes.length || range.endContainer !== blockElement.lastChild) {
                afterBlock = document.createElement(originalTagName)
                const afterRange = document.createRange()
                afterRange.setStart(range.endContainer, range.endOffset)
                afterRange.setEnd(blockElement, blockElement.childNodes.length)
                const afterContent = afterRange.extractContents()
                if (afterContent.textContent?.trim()) {
                    afterBlock.appendChild(afterContent)
                    parent.insertBefore(afterBlock, blockElement)
                }
            }

            // Remove the original block
            parent.removeChild(blockElement)

            // Select the new formatted block
            range.selectNodeContents(newBlock)
            return true
        } catch (error) {
            console.error('Failed to split block and apply format:', error)
            return false
        }
    }

    const convertSingleBlock = (tagName: string, blockElement: Element, range: Range): boolean => {
        try {
            // Check if the block is already the target format
            if (blockElement.tagName.toLowerCase() === tagName.toLowerCase()) {
                // Convert to paragraph
                const paragraph = document.createElement('p')
                while (blockElement.firstChild) {
                    paragraph.appendChild(blockElement.firstChild)
                }
                blockElement.parentNode?.replaceChild(paragraph, blockElement)
                range.selectNodeContents(paragraph)
                return true
            } else {
                // Convert to new format
                const element = document.createElement(tagName)
                while (blockElement.firstChild) {
                    element.appendChild(blockElement.firstChild)
                }
                blockElement.parentNode?.replaceChild(element, blockElement)
                range.selectNodeContents(element)
                return true
            }
        } catch (error) {
            console.error('Failed to convert single block:', error)
            return false
        }
    }

    const wrapSelectionInBlock = (tagName: string, range: Range): boolean => {
        try {
            // Create the new block element
            const element = document.createElement(tagName)
            
            // Extract the selected content
            const fragment = range.extractContents()
            element.appendChild(fragment)
            
            // Insert the new block element
            range.insertNode(element)
            
            // Select the new element
            range.selectNodeContents(element)
            
            // Clean up any empty blocks that might have been created
            cleanupEmptyBlocks(range)
            
            return true
        } catch (error) {
            console.error('Failed to wrap selection in block:', error)
            return false
        }
    }

    const cleanupEmptyBlocks = (range: Range): void => {
        try {
            // Find and remove any empty block elements near the range
            const container = range.commonAncestorContainer
            const parent = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
            
            if (parent) {
                const emptyBlocks = parent.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6')
                emptyBlocks.forEach(block => {
                    if (!block.textContent?.trim() && block !== parent) {
                        block.parentNode?.removeChild(block)
                    }
                })
            }
        } catch (error) {
            console.error('Failed to cleanup empty blocks:', error)
        }
    }

    const convertCurrentBlock = (tagName: string, range: Range): boolean => {
        try {
            // Find the block element that contains the cursor
            const container = range.commonAncestorContainer
            const blockElement = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
            
            if (!blockElement) return false
            
            // Find the closest block-level element
            const closestBlock = blockElement.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre')
            if (!closestBlock) return false
            
            // Check if the block is already the target format type
            if (closestBlock.tagName.toLowerCase() === tagName.toLowerCase()) {
                // If it's already the target format, convert it to paragraph
                const paragraph = document.createElement('p')
                
                // Move all contents to the paragraph
                while (closestBlock.firstChild) {
                    paragraph.appendChild(closestBlock.firstChild)
                }
                
                // Replace the current element with the paragraph
                closestBlock.parentNode?.replaceChild(paragraph, closestBlock)
                
                // Update the range to point to the new paragraph
                range.selectNodeContents(paragraph)
                return true
            } else {
                // Apply the new block format
                const element = document.createElement(tagName)
                
                // Move all contents to the new element
                while (closestBlock.firstChild) {
                    element.appendChild(closestBlock.firstChild)
                }
                
                // Replace the current block with the new format
                closestBlock.parentNode?.replaceChild(element, closestBlock)
                
                // Update the range to point to the new element
                range.selectNodeContents(element)
                return true
            }
        } catch (error) {
            console.error('Failed to convert current block:', error)
            return false
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
            // Check if the range can be surrounded (only text nodes)
            if (range.collapsed) {
                // If no selection, apply to the current element
                const container = range.commonAncestorContainer
                if (container.nodeType === Node.TEXT_NODE) {
                    const textNode = container as Text
                    const mark = document.createElement('mark')
                    mark.style.backgroundColor = color
                    textNode.parentNode?.insertBefore(mark, textNode)
                    mark.appendChild(textNode)
                } else if (container.nodeType === Node.ELEMENT_NODE) {
                    (container as HTMLElement).style.backgroundColor = color
                }
                return true
            }

            // Try to surround contents first
            try {
                const mark = document.createElement('mark')
                mark.style.backgroundColor = color
                range.surroundContents(mark)
                return true
            } catch (surroundError) {
                // If surroundContents fails, walk through text nodes and wrap them individually
                const walker = document.createTreeWalker(
                    range.commonAncestorContainer,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                        }
                    }
                )

                const textNodes: Text[] = []
                let node
                while (node = walker.nextNode()) {
                    textNodes.push(node as Text)
                }

                if (textNodes.length === 0) {
                    // No text nodes found, apply to the container element
                    const container = range.commonAncestorContainer
                    if (container.nodeType === Node.ELEMENT_NODE) {
                        (container as HTMLElement).style.backgroundColor = color
                    }
                    return true
                }

                // Wrap each text node individually
                textNodes.forEach(textNode => {
                    if (textNode.textContent && textNode.textContent.trim()) {
                        const mark = document.createElement('mark')
                        mark.style.backgroundColor = color
                        textNode.parentNode?.insertBefore(mark, textNode)
                        mark.appendChild(textNode)
                    }
                })

                return true
            }
        } catch (error) {
            console.error('Failed to apply background color:', error)
            return false
        }
    }

    const applyTextColor = (color: string, range: Range): boolean => {
        try {
            // Check if the range can be surrounded (only text nodes)
            if (range.collapsed) {
                // If no selection, apply to the current element
                const container = range.commonAncestorContainer
                if (container.nodeType === Node.TEXT_NODE) {
                    const textNode = container as Text
                    const span = document.createElement('span')
                    span.style.color = color
                    textNode.parentNode?.insertBefore(span, textNode)
                    span.appendChild(textNode)
                } else if (container.nodeType === Node.ELEMENT_NODE) {
                    (container as HTMLElement).style.color = color
                }
                return true
            }

            // Try to surround contents first
            try {
                const span = document.createElement('span')
                span.style.color = color
                range.surroundContents(span)
                return true
            } catch (surroundError) {
                // If surroundContents fails, walk through text nodes and wrap them individually
                const walker = document.createTreeWalker(
                    range.commonAncestorContainer,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                        }
                    }
                )

                const textNodes: Text[] = []
                let node
                while (node = walker.nextNode()) {
                    textNodes.push(node as Text)
                }

                if (textNodes.length === 0) {
                    // No text nodes found, apply to the container element
                    const container = range.commonAncestorContainer
                    if (container.nodeType === Node.ELEMENT_NODE) {
                        (container as HTMLElement).style.color = color
                    }
                    return true
                }

                // Wrap each text node individually
                textNodes.forEach(textNode => {
                    if (textNode.textContent && textNode.textContent.trim()) {
                        const span = document.createElement('span')
                        span.style.color = color
                        textNode.parentNode?.insertBefore(span, textNode)
                        span.appendChild(textNode)
                    }
                })

                return true
            }
        } catch (error) {
            console.error('Failed to apply text color:', error)
            return false
        }
    }

    const applyFontSize = (size: string, range: Range): boolean => {
        try {
            if (range.collapsed) {
                const container = range.commonAncestorContainer
                if (container.nodeType === Node.TEXT_NODE) {
                    const textNode = container as Text
                    const span = document.createElement('span')
                    span.style.fontSize = size
                    textNode.parentNode?.insertBefore(span, textNode)
                    span.appendChild(textNode)
                } else if (container.nodeType === Node.ELEMENT_NODE) {
                    (container as HTMLElement).style.fontSize = size
                }
                return true
            }

            try {
                const span = document.createElement('span')
                span.style.fontSize = size
                range.surroundContents(span)
                return true
            } catch (surroundError) {
                const walker = document.createTreeWalker(
                    range.commonAncestorContainer,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                        }
                    }
                )

                const textNodes: Text[] = []
                let node
                while (node = walker.nextNode()) {
                    textNodes.push(node as Text)
                }

                if (textNodes.length === 0) {
                    const container = range.commonAncestorContainer
                    if (container.nodeType === Node.ELEMENT_NODE) {
                        (container as HTMLElement).style.fontSize = size
                    }
                    return true
                }

                textNodes.forEach(textNode => {
                    if (textNode.textContent && textNode.textContent.trim()) {
                        const span = document.createElement('span')
                        span.style.fontSize = size
                        textNode.parentNode?.insertBefore(span, textNode)
                        span.appendChild(textNode)
                    }
                })

                return true
            }
        } catch (error) {
            console.error('Failed to apply font size:', error)
            return false
        }
    }

    const applyFontFamily = (family: string, range: Range): boolean => {
        try {
            if (range.collapsed) {
                const container = range.commonAncestorContainer
                if (container.nodeType === Node.TEXT_NODE) {
                    const textNode = container as Text
                    const span = document.createElement('span')
                    span.style.fontFamily = family
                    textNode.parentNode?.insertBefore(span, textNode)
                    span.appendChild(textNode)
                } else if (container.nodeType === Node.ELEMENT_NODE) {
                    (container as HTMLElement).style.fontFamily = family
                }
                return true
            }

            try {
                const span = document.createElement('span')
                span.style.fontFamily = family
                range.surroundContents(span)
                return true
            } catch (surroundError) {
                const walker = document.createTreeWalker(
                    range.commonAncestorContainer,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                        }
                    }
                )

                const textNodes: Text[] = []
                let node
                while (node = walker.nextNode()) {
                    textNodes.push(node as Text)
                }

                if (textNodes.length === 0) {
                    const container = range.commonAncestorContainer
                    if (container.nodeType === Node.ELEMENT_NODE) {
                        (container as HTMLElement).style.fontFamily = family
                    }
                    return true
                }

                textNodes.forEach(textNode => {
                    if (textNode.textContent && textNode.textContent.trim()) {
                        const span = document.createElement('span')
                        span.style.fontFamily = family
                        textNode.parentNode?.insertBefore(span, textNode)
                        span.appendChild(textNode)
                    }
                })

                return true
            }
        } catch (error) {
            console.error('Failed to apply font family:', error)
            return false
        }
    }

    // Check if cursor is inside a table
    const checkIfInsideTable = useCallback(() => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const container = range.commonAncestorContainer
            const tableElement = container.nodeType === Node.ELEMENT_NODE 
                ? (container as Element).closest('table')
                : (container as Element).parentElement?.closest('table')
            
            return !!tableElement
        }
        return false
    }, [])

    // Table functions
    const insertTable = useCallback((rows: number, cols: number) => {
        if (!editorRef.current) return

        // Check if cursor is inside a table
        if (checkIfInsideTable()) {
            console.warn('Cannot insert table inside another table')
            return
        }

        // Save current state for undo
        const currentContent = editorRef.current.innerHTML
        saveToUndoStack(currentContent)
        
        // Create simple table HTML string
        let tableHTML = '<table class="editor-table" data-table="true"><tbody>'
        
        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr>'
            for (let j = 0; j < cols; j++) {
                tableHTML += '<td contenteditable="true" data-table-cell="true"><br></td>'
            }
            tableHTML += '</tr>'
        }
        
        tableHTML += '</tbody></table><p><br></p>'
        
        // Get current cursor position
        const selection = window.getSelection()
        let range: Range
        
        if (selection && selection.rangeCount > 0) {
            range = selection.getRangeAt(0)
        } else {
            // Create range at the end of the editor
            range = document.createRange()
            range.selectNodeContents(editorRef.current)
            range.collapse(false)
        }
        
        // Insert the table HTML
        try {
            // Create a temporary container to parse the HTML
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = tableHTML
            
            // Insert each child node
            while (tempDiv.firstChild) {
                const node = tempDiv.firstChild
                tempDiv.removeChild(node)
                range.insertNode(node)
                range.setStartAfter(node)
            }
            
            // Update content
            const newContent = editorRef.current.innerHTML
            setContent(newContent)
            updateFormatState()
            
            // Focus on first cell
            setTimeout(() => {
                const firstCell = editorRef.current?.querySelector('td') as HTMLTableCellElement
                if (firstCell) {
                    const newRange = document.createRange()
                    newRange.selectNodeContents(firstCell)
                    newRange.collapse(true)
                    if (selection) {
                        selection.removeAllRanges()
                        selection.addRange(newRange)
                    }
                    firstCell.focus()
                }
            }, 50)
            
            
        } catch (error) {
            console.error('Error inserting table:', error)
            // Fallback: simple append
            editorRef.current.insertAdjacentHTML('beforeend', tableHTML)
            const newContent = editorRef.current.innerHTML
            setContent(newContent)
            updateFormatState()
        }
        
    }, [saveToUndoStack, updateFormatState])

    const handleTableContextMenu = useCallback((e: React.MouseEvent, tableElement: HTMLTableElement, cellElement?: HTMLTableCellElement) => {
        e.preventDefault()
        setTableContextMenu({
            isOpen: true,
            position: { x: e.clientX, y: e.clientY },
            tableElement,
            cellElement
        })
    }, [])

    const insertTableRow = useCallback((position: 'above' | 'below') => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const row = cellElement.parentElement as HTMLTableRowElement
        const table = cellElement.closest('table') as HTMLTableElement
        if (!row || !table) return

        saveToUndoStack(editorRef.current.innerHTML)

        const newRow = document.createElement('tr')
        const cellCount = row.cells.length
        
        for (let i = 0; i < cellCount; i++) {
            const td = document.createElement('td')
            td.setAttribute('contenteditable', 'true')
            td.setAttribute('data-table-cell', 'true')
            td.innerHTML = '&nbsp;'
            newRow.appendChild(td)
        }

        if (position === 'above') {
            row.parentNode?.insertBefore(newRow, row)
        } else {
            row.parentNode?.insertBefore(newRow, row.nextSibling)
        }

        const newContent = editorRef.current.innerHTML
        setContent(newContent)
        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
        
    }, [tableContextMenu, saveToUndoStack, updateFormatState])

    const insertTableColumn = useCallback((position: 'left' | 'right') => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const row = cellElement.parentElement as HTMLTableRowElement
        const table = cellElement.closest('table') as HTMLTableElement
        if (!row || !table) return

        saveToUndoStack(editorRef.current.innerHTML)

        const cellIndex = Array.from(row.cells).indexOf(cellElement)
        
        // Insert cell in all rows
        const rows = table.querySelectorAll('tr')
        rows.forEach(tr => {
            const td = document.createElement('td')
            td.setAttribute('contenteditable', 'true')
            td.setAttribute('data-table-cell', 'true')
            td.innerHTML = '&nbsp;'
            
            if (position === 'left') {
                tr.insertBefore(td, tr.children[cellIndex])
            } else {
                tr.insertBefore(td, tr.children[cellIndex + 1])
            }
        })

        const newContent = editorRef.current.innerHTML
        setContent(newContent)
        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
        
    }, [tableContextMenu, saveToUndoStack, updateFormatState])

    const deleteTableRow = useCallback(() => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const row = cellElement.parentElement as HTMLTableRowElement
        const table = cellElement.closest('table') as HTMLTableElement
        if (!row || !table) return

        // Don't delete if it's the only row
        if (table.rows.length <= 1) return

        saveToUndoStack(editorRef.current.innerHTML)
        row.remove()

        const newContent = editorRef.current.innerHTML
        setContent(newContent)
        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
        
    }, [tableContextMenu, saveToUndoStack, updateFormatState])

    const deleteTableColumn = useCallback(() => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const table = cellElement.closest('table') as HTMLTableElement
        if (!table) return

        // Don't delete if it's the only column
        if (table.rows[0]?.cells.length <= 1) return

        saveToUndoStack(editorRef.current.innerHTML)

        const cellIndex = Array.from((cellElement.parentElement as HTMLTableRowElement).cells).indexOf(cellElement)
        
        // Remove cell from all rows
        const rows = table.querySelectorAll('tr')
        rows.forEach(tr => {
            const cell = tr.children[cellIndex]
            if (cell) cell.remove()
        })

        const newContent = editorRef.current.innerHTML
        setContent(newContent)
        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
        
    }, [tableContextMenu, saveToUndoStack, updateFormatState])

    const deleteTable = useCallback(() => {
        const { tableElement } = tableContextMenu
        if (!tableElement || !editorRef.current) return

        saveToUndoStack(editorRef.current.innerHTML)
        tableElement.remove()

        const newContent = editorRef.current.innerHTML
        setContent(newContent)
        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
        
    }, [tableContextMenu, saveToUndoStack, updateFormatState])

    // Simple column resize functions
    const startColumnResize = useCallback((e: React.MouseEvent, cell: HTMLElement) => {
        e.preventDefault()
        const rect = cell.getBoundingClientRect()
        setColumnResizeData({
            startX: e.clientX,
            startWidth: rect.width,
            cell
        })
        setIsResizingColumn(true)
    }, [])

    const handleColumnMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingColumn || !columnResizeData.cell) return
        
        const deltaX = e.clientX - columnResizeData.startX
        const newWidth = Math.max(50, columnResizeData.startWidth + deltaX)
        
        // Apply width to all cells in the same column
        const table = columnResizeData.cell.closest('table')
        if (table) {
            const row = columnResizeData.cell.closest('tr')
            if (row) {
                const cellIndex = Array.from(row.children).indexOf(columnResizeData.cell)
                const allRows = table.querySelectorAll('tr')
                allRows.forEach(r => {
                    const cell = r.children[cellIndex] as HTMLElement
                    if (cell) cell.style.width = `${newWidth}px`
                })
            }
        }
    }, [isResizingColumn, columnResizeData])

    const handleColumnMouseUp = useCallback(() => {
        setIsResizingColumn(false)
        setColumnResizeData({ startX: 0, startWidth: 0, cell: null })
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML)
        }
    }, [])

    useEffect(() => {
        if (isResizingColumn) {
            document.addEventListener('mousemove', handleColumnMouseMove)
            document.addEventListener('mouseup', handleColumnMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleColumnMouseMove)
                document.removeEventListener('mouseup', handleColumnMouseUp)
            }
        }
        return undefined
    }, [isResizingColumn, handleColumnMouseMove, handleColumnMouseUp])

    // Simple row resize functions
    const startRowResize = useCallback((e: React.MouseEvent, cell: HTMLElement) => {
        e.preventDefault()
        const row = cell.closest('tr')
        if (row) {
            const rowRect = row.getBoundingClientRect()
            setRowResizeData({
                startY: e.clientY,
                startHeight: rowRect.height,
                cell
            })
            setIsResizingRow(true)
        }
    }, [])

    const handleRowMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingRow || !rowResizeData.cell) return
        
        const deltaY = e.clientY - rowResizeData.startY
        const newHeight = Math.max(30, rowResizeData.startHeight + deltaY)
        
        // Apply height to all cells in the same row
        const row = rowResizeData.cell.closest('tr')
        if (row) {
            const cells = row.querySelectorAll('td, th')
            cells.forEach(cell => {
                (cell as HTMLElement).style.height = `${newHeight}px`
            })
        }
    }, [isResizingRow, rowResizeData])

    const handleRowMouseUp = useCallback(() => {
        setIsResizingRow(false)
        setRowResizeData({ startY: 0, startHeight: 0, cell: null })
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML)
        }
    }, [])

    useEffect(() => {
        if (isResizingRow) {
            document.addEventListener('mousemove', handleRowMouseMove)
            document.addEventListener('mouseup', handleRowMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleRowMouseMove)
                document.removeEventListener('mouseup', handleRowMouseUp)
            }
        }
        return undefined
    }, [isResizingRow, handleRowMouseMove, handleRowMouseUp])

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
                case 'l':
                    if (isShift) {
                        e.preventDefault()
                        setIsAIChatOpen(!isAIChatOpen)
                    }
                    break
                case 't':
                    if (isShift) {
                        e.preventDefault()
                        const insideTable = checkIfInsideTable()
                        setIsInsideTable(insideTable)
                        setShowTableManager(true)
                    }
                    break
        }
        }
     }, [handleFormat, undo, redo, handleManualSave, isAIChatOpen, checkIfInsideTable])

    // Handle content changes from the editor
    const handleContentChange = useCallback(() => {
        if (editorRef.current && !isUndoRedo && !isUpdatingContentRef.current) {
            const newContent = editorRef.current.innerHTML
            
            // Only update if content actually changed to prevent infinite loops
            if (newContent !== content) {
                isUpdatingContentRef.current = true
                setContent(newContent)
                // Save to undo stack when content changes (but not during undo/redo)
                saveToUndoStack(newContent)
                
                // Only detect user typing if agent is not typing
                if (!isAgentTyping) {
                    setIsUserTyping(true)
                    setLastUserTypingTime(new Date())
                }
                
                // Reset the flag after a brief delay to allow the update to complete
                setTimeout(() => {
                    isUpdatingContentRef.current = false
                }, 10)
            }
        }
    }, [saveToUndoStack, isUndoRedo, isAgentTyping, content])

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
    }, [saveToUndoStack])

    // Insert image from file
    const insertImageFromFile = useCallback((file: File) => {
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = document.createElement('img')
            img.src = event.target?.result as string
            img.style.maxWidth = '100%'
            img.style.height = 'auto'
            img.className = 'editor-image'
            img.style.position = 'relative'
            img.style.display = 'inline-block'
            
            // Create a wrapper div with relative positioning for the handles
            const wrapper = document.createElement('div')
            wrapper.style.position = 'relative'
            wrapper.style.display = 'inline-block'
            wrapper.appendChild(img)
            
            // Insert the wrapper at cursor position
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                range.deleteContents()
                range.insertNode(wrapper)
                range.setStartAfter(wrapper)
                range.setEndAfter(wrapper)
                selection.removeAllRanges()
                selection.addRange(range)
                
                // Save to undo stack
                if (editorRef.current) {
                    saveToUndoStack(editorRef.current.innerHTML)
                }
            }
        }
        reader.readAsDataURL(file)
    }, [saveToUndoStack])

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

    // Handle image resize with drag
    const handleImageResize = useCallback((img: HTMLImageElement, width: number, height: number) => {
        // Update the image dimensions
        img.style.width = `${width}px`
        img.style.height = `${height}px`
        img.style.maxWidth = 'none'
        
        // Update the selectedImage state if it's the same image
        if (selectedImage === img) {
            setSelectedImage(img)
        }
        
        // Save to undo stack
        if (editorRef.current) {
            saveToUndoStack(editorRef.current.innerHTML)
        }
    }, [selectedImage, saveToUndoStack])

    // Add resize handles to image
    const addResizeHandles = useCallback((img: HTMLImageElement) => {
        // Find the wrapper div (parent of the image)
        const wrapper = img.parentElement
        if (!wrapper) return
        
        // Remove existing handles
        const existingHandles = wrapper.querySelectorAll('.resize-handle')
        existingHandles?.forEach(handle => handle.remove())

        const handles = ['nw', 'ne', 'sw', 'se'] // corners
        handles.forEach(pos => {
            const handle = document.createElement('div')
            handle.className = `resize-handle resize-${pos}`
            handle.style.cssText = `
                position: absolute;
                width: 12px;
                height: 12px;
                background: #3b82f6;
                border: 2px solid white;
                cursor: ${pos.includes('n') ? 'n' : 's'}-${pos.includes('w') ? 'w' : 'e'}-resize;
                z-index: 1000;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);
            `
            
            // Position the handle relative to the wrapper
            if (pos.includes('n')) handle.style.top = '-6px'
            if (pos.includes('s')) handle.style.bottom = '-6px'
            if (pos.includes('w')) handle.style.left = '-6px'
            if (pos.includes('e')) handle.style.right = '-6px'
            
            // Add drag functionality
            let startX: number, startY: number, startWidth: number, startHeight: number
            let isDragging = false
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault()
                e.stopPropagation()
                isDragging = true
                startX = e.clientX
                startY = e.clientY
                startWidth = img.offsetWidth
                startHeight = img.offsetHeight
                
                // Add a visual indicator that dragging has started
                handle.style.transform = 'scale(1.2)'
                
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
            })
            
            const onMouseMove = (e: MouseEvent) => {
                if (!isDragging) return
                
                const deltaX = e.clientX - startX
                const deltaY = e.clientY - startY
                
                let newWidth = startWidth
                let newHeight = startHeight
                
                // Calculate new dimensions based on handle position
                if (pos.includes('e')) newWidth = startWidth + deltaX
                if (pos.includes('w')) newWidth = startWidth - deltaX
                if (pos.includes('s')) newHeight = startHeight + deltaY
                if (pos.includes('n')) newHeight = startHeight - deltaY
                
                // Maintain aspect ratio (only if both dimensions are being changed)
                if (pos === 'nw' || pos === 'ne' || pos === 'sw' || pos === 'se') {
                    const aspectRatio = img.naturalWidth / img.naturalHeight
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        newHeight = newWidth / aspectRatio
                    } else {
                        newWidth = newHeight * aspectRatio
                    }
                }
                
                // Apply minimum size
                newWidth = Math.max(50, newWidth)
                newHeight = Math.max(50, newHeight)
                
                // Update the image dimensions immediately for smooth dragging
                img.style.width = `${newWidth}px`
                img.style.height = `${newHeight}px`
                img.style.maxWidth = 'none'
                
                // Also call the resize handler for undo stack
                handleImageResize(img, newWidth, newHeight)
            }
            
            const onMouseUp = () => {
                isDragging = false
                // Reset handle appearance
                handle.style.transform = 'scale(1)'
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
            }
            
            wrapper.appendChild(handle)
        })
    }, [handleImageResize])

    // Handle image selection
    const handleImageClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        
        if (target.tagName === 'IMG') {
            e.preventDefault()
            e.stopPropagation()
            
            // Remove previous selection styling and handles
            const prevSelected = document.querySelector('.editor-image.selected')
            if (prevSelected) {
                prevSelected.classList.remove('selected')
                const existingHandles = prevSelected.parentElement?.querySelectorAll('.resize-handle, .crop-handle')
                existingHandles?.forEach(handle => handle.remove())
            }
            
            // Add selection styling to current image
            target.classList.add('selected')
            
            setSelectedImage(target as HTMLImageElement)
            
            // Show resize handles by default
            addResizeHandles(target as HTMLImageElement)
        } else {
            // Clicked on non-image, deselect current image
            const prevSelected = document.querySelector('.editor-image.selected')
            if (prevSelected) {
                prevSelected.classList.remove('selected')
                const existingHandles = prevSelected.parentElement?.querySelectorAll('.resize-handle, .crop-handle')
                existingHandles?.forEach(handle => handle.remove())
            }
            setSelectedImage(null)
        }
    }, [addResizeHandles])
    
    // Handle right-click on image to toggle between resize and crop handles
    const handleImageRightClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.tagName === 'IMG' && selectedImage === target) {
            e.preventDefault()
            e.stopPropagation()
            
            const currentHandles = target.parentElement?.querySelectorAll('.resize-handle, .crop-handle')
            const hasResizeHandles = target.parentElement?.querySelector('.resize-handle')
            
            // Remove current handles
            currentHandles?.forEach(handle => handle.remove())
            
            // Toggle between resize and crop
            if (hasResizeHandles) {
                addCropHandles(target as HTMLImageElement)
            } else {
                addResizeHandles(target as HTMLImageElement)
            }
        }
    }, [selectedImage])

    // Add crop handles to image
    const addCropHandles = useCallback((img: HTMLImageElement) => {
        // Find the wrapper div (parent of the image)
        const wrapper = img.parentElement
        if (!wrapper) return
        
        // Remove existing handles
        const existingHandles = wrapper.querySelectorAll('.crop-handle')
        existingHandles?.forEach(handle => handle.remove())

        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] // corners and edges
        handles.forEach(pos => {
            const handle = document.createElement('div')
            handle.className = `crop-handle crop-${pos}`
            handle.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: #ef4444;
                border: 1px solid white;
                cursor: ${pos.includes('n') ? 'n' : pos.includes('s') ? 's' : ''}${pos.includes('w') ? 'w' : pos.includes('e') ? 'e' : ''}-resize;
                z-index: 1000;
            `
            
            // Position the handle
            if (pos === 'n') handle.style.top = '-4px'
            if (pos === 's') handle.style.bottom = '-4px'
            if (pos === 'w') handle.style.left = '-4px'
            if (pos === 'e') handle.style.right = '-4px'
            if (pos === 'nw') { handle.style.top = '-4px'; handle.style.left = '-4px' }
            if (pos === 'ne') { handle.style.top = '-4px'; handle.style.right = '-4px' }
            if (pos === 'sw') { handle.style.bottom = '-4px'; handle.style.left = '-4px' }
            if (pos === 'se') { handle.style.bottom = '-4px'; handle.style.right = '-4px' }
            
            // Add drag functionality for cropping
            let startX: number, startY: number, startRect: DOMRect
            let isDragging = false
            let cropOverlay: HTMLDivElement
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault()
                e.stopPropagation()
                isDragging = true
                startX = e.clientX
                startY = e.clientY
                startRect = img.getBoundingClientRect()
                
                // Create crop overlay
                cropOverlay = document.createElement('div')
                cropOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    pointer-events: none;
                    z-index: 999;
                `
                wrapper.appendChild(cropOverlay)
                
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
            })
            
            const onMouseMove = (e: MouseEvent) => {
                if (!isDragging) return
                
                const deltaX = e.clientX - startX
                const deltaY = e.clientY - startY
                
                // Calculate crop area based on handle position
                let cropX = 0, cropY = 0, cropWidth = img.naturalWidth, cropHeight = img.naturalHeight
                
                if (pos.includes('e')) cropWidth = startRect.width - deltaX
                if (pos.includes('w')) { cropX = deltaX; cropWidth = startRect.width - deltaX }
                if (pos.includes('s')) cropHeight = startRect.height - deltaY
                if (pos.includes('n')) { cropY = deltaY; cropHeight = startRect.height - deltaY }
                
                // Apply minimum size
                cropWidth = Math.max(50, cropWidth)
                cropHeight = Math.max(50, cropHeight)
                
                // Update crop overlay
                if (cropOverlay) {
                    cropOverlay.style.clipPath = `inset(${cropY}px ${startRect.width - cropX - cropWidth}px ${startRect.height - cropY - cropHeight}px ${cropX}px)`
                }
            }
            
            const onMouseUp = () => {
                if (isDragging && cropOverlay) {
                    // Apply the crop
                    const rect = img.getBoundingClientRect()
                    const scaleX = img.naturalWidth / rect.width
                    const scaleY = img.naturalHeight / rect.height
                    
                    const cropData = {
                        x: 0,
                        y: 0,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    }
                    
                    // Calculate actual crop coordinates
                    if (pos.includes('e')) cropData.width = Math.max(50, img.naturalWidth - (startX - rect.left) * scaleX)
                    if (pos.includes('w')) { cropData.x = (startX - rect.left) * scaleX; cropData.width = Math.max(50, img.naturalWidth - cropData.x) }
                    if (pos.includes('s')) cropData.height = Math.max(50, img.naturalHeight - (startY - rect.top) * scaleY)
                    if (pos.includes('n')) { cropData.y = (startY - rect.top) * scaleY; cropData.height = Math.max(50, img.naturalHeight - cropData.y) }
                    
                    handleImageCrop(cropData)
                }
                
                isDragging = false
                if (cropOverlay) cropOverlay.remove()
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
            }
            
            wrapper.appendChild(handle)
        })
    }, [])

    // Handle image crop
    const handleImageCrop = useCallback((cropData: { x: number; y: number; width: number; height: number }) => {
        if (selectedImage) {
            // Create a canvas to crop the image
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (ctx) {
                canvas.width = cropData.width
                canvas.height = cropData.height
                
                // Draw the cropped portion
                ctx.drawImage(
                    selectedImage,
                    cropData.x, cropData.y, cropData.width, cropData.height,
                    0, 0, cropData.width, cropData.height
                )
                
                // Replace the image with cropped version
                const newImg = document.createElement('img')
                newImg.src = canvas.toDataURL()
                newImg.style.width = `${cropData.width}px`
                newImg.style.height = `${cropData.height}px`
                newImg.className = 'editor-image'
                
                selectedImage.parentNode?.replaceChild(newImg, selectedImage)
                
                // Save to undo stack
                if (editorRef.current) {
                    saveToUndoStack(editorRef.current.innerHTML)
                }
            }
        }
    }, [selectedImage, saveToUndoStack])






    // Add selection change listener
    useEffect(() => {
        if (!mounted) return
        
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                if (range.toString().length > 0 || range.collapsed) {
                    // Update format state for both selections and cursor position
                    // Add a small delay to ensure DOM is stable
                    setTimeout(() => updateFormatState(), 0)
                } else {
                    // Reset format state when no text is selected and cursor is not in editor
                    if (!editorRef.current?.contains(selection.anchorNode)) {
                        resetFormatState()
                    }
                }
            } else {
                // Reset format state when no selection
                resetFormatState()
            }
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [updateFormatState, resetFormatState, mounted])

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false)
            }
        }

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showColorPicker])

    const getWordCount = () => {
        const text = content.replace(/<[^>]*>/g, '')
        return text.split(/\s+/).filter(Boolean).length
    }

    const getCharCount = () => {
        return content.replace(/<[^>]*>/g, '').length
    }

    // HSL to Hex conversion helper
    const hslToHex = (h: number, s: number, l: number) => {
        // Ensure valid numbers
        h = isNaN(h) ? 0 : Math.max(0, Math.min(360, h))
        s = isNaN(s) ? 0 : Math.max(0, Math.min(100, s))
        l = isNaN(l) ? 50 : Math.max(0, Math.min(100, l))
        
        h /= 360
        s /= 100
        l /= 100

        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
        }

        let r, g, b
        if (s === 0) {
            r = g = b = l
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s
            const p = 2 * l - q
            r = hue2rgb(p, q, h + 1/3)
            g = hue2rgb(p, q, h)
            b = hue2rgb(p, q, h - 1/3)
        }

        const toHex = (c: number) => {
            const hex = Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16)
            return hex.length === 1 ? '0' + hex : hex
        }

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    // Hex to HSL conversion helper
    const hexToHsl = (hex: string) => {
        if (!hex || !hex.match(/^#[0-9A-Fa-f]{6}$/)) {
            return [0, 0, 50] // Default to gray if invalid
        }
        
        const r = parseInt(hex.slice(1, 3), 16) / 255
        const g = parseInt(hex.slice(3, 5), 16) / 255
        const b = parseInt(hex.slice(5, 7), 16) / 255

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        let h = 0, s = 0, l = (max + min) / 2

        if (max !== min) {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break
                case g: h = (b - r) / d + 2; break
                case b: h = (r - g) / d + 4; break
            }
            h /= 6
        }
        
        return [
            Math.round(h * 360),
            Math.round(s * 100),
            Math.round(l * 100)
        ]
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
            <div className={`flex-1 flex flex-col relative transition-all duration-300 ease-in-out`} style={{ marginRight: isAIChatOpen ? `${aiChatWidth}px` : '0px' }}>
            {/* Fixed Toolbar - Google Docs Style */}
            <div className="h-14 editor-toolbar flex items-center px-4 gap-2 overflow-x-auto min-w-0">
                {/* Back Button */}
                <button 
                    onClick={() => handleNavigation("/home")}
                    className="p-1 hover:bg-gray-100 rounded transition-colors mr-0.5"
                    title="Back to Home"
                    suppressHydrationWarning
                >
                    <ArrowLeft className="w-3 h-3 text-gray-600" />
                </button>
                
                <div className="w-px h-4 bg-gray-300"></div>
                
                {/* Undo/Redo */}
                <div className="flex items-center gap-0.5 mr-0.5">
                    <button
                        onClick={undo}
                        disabled={undoStack.length <= 1}
                        className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Undo (Ctrl+Z)"
                        suppressHydrationWarning
                    >
                        <Undo2 className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={redoStack.length === 0}
                        className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Redo (Ctrl+Shift+Z)"
                        suppressHydrationWarning
                    >
                        <Redo2 className="w-3 h-3 text-gray-600" />
                    </button>
                </div>
                
                <div className="w-px h-6 bg-gray-300"></div>

                                 {/* Document Title */}
                 <div className="flex-1 min-w-0 ml-1 mr-1" style={{ minWidth: '120px', maxWidth: '250px' }}>
                     <div className="relative z-10">

                         {isLoading ? (
                             <div className="w-full px-2 py-1.5 text-base font-semibold text-gray-400 bg-gray-50 rounded animate-pulse">
                                 Loading...
                             </div>
                         ) : (
                             <input
                                 type="text"
                                 value={documentTitle || 'Untitled Document'}
                                 onChange={(e) => {
                                     const newTitle = e.target.value
                                     setDocumentTitle(newTitle)
                                 }}
                                 onBlur={() => {
                                     if (documentId !== 'new' && documentTitle.trim()) {
                                         // Save title change
                                         setIsSavingTitle(true)
                                         const currentContent = editorRef.current?.innerHTML || content
                                         saveDocument(currentContent, false).then(() => {
                                             // Update original content and title to reflect saved state
                                             setOriginalContent(currentContent)
                                             setOriginalTitle(documentTitle.trim())
                                             setHasUnsavedChanges(false)
                                         }).catch(error => {
                                             console.error('Failed to save title:', error)
                                             setSaveError('Failed to save title')
                                         }).finally(() => {
                                             setIsSavingTitle(false)
                                         })
                                     }
                                 }}
                                 onKeyDown={(e) => {
                                     if (e.key === 'Enter') {
                                         e.preventDefault()
                                         e.currentTarget.blur() // Trigger save on Enter
                                     }
                                     if (e.key === 'Escape') {
                                         e.preventDefault()
                                         // Reset title to original value
                                         if (documentId !== 'new') {
                                             setDocumentTitle(originalTitle)
                                         }
                                         e.currentTarget.blur()
                                     }
                                 }}
                                className={`w-full px-2 py-1.5 text-base font-semibold text-black bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors min-w-0 ${
                                    isSavingTitle ? 'ring-2 ring-blue-300 bg-blue-50 border-blue-300' : ''
                                }`}
                                 placeholder="Untitled Document"
                                 suppressHydrationWarning
                                 maxLength={100}
                             />
                         )}
                         {documentTitle.length > 80 && !isLoading && (
                             <div className="text-xs text-gray-400 mt-1">
                                 {documentTitle.length}/100 characters
                             </div>
                         )}
                         {documentId !== 'new' && !isLoading && isSavingTitle && (
                             <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                                 <span className="text-blue-600">Saving...</span>
                             </div>
                         )}
                     </div>
                 </div>

                <div className="w-px h-6 bg-gray-300"></div>

                                 {/* Save Button and Status */}
                 <div className="flex items-center gap-0.5 mr-1">
                     <button
                         onClick={handleManualSave}
                         disabled={isSaving || documentId === 'new'}
                         className={`p-1 rounded-lg transition-all ${
                             justSaved
                                 ? 'bg-white text-blue-600 border-2 border-blue-500'
                                 : isSaving
                                     ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                                     : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                         }`}
                         title={documentId === 'new' ? 'Save document first' : hasUnsavedChanges ? 'Save document (Ctrl+S)' : 'All changes saved'}
                         suppressHydrationWarning
                     >
                         <Check className="w-3 h-3" />
                     </button>
                    
                    {/* Save Status Indicator */}
                    {saveError && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                            <span className="text-red-600">⚠️</span>
                            <span className="text-sm text-red-700">{saveError}</span>
                        </div>
                    )}
                    


                    
                </div>

                <div className="w-px h-6 bg-gray-300"></div>

                                 {/* Delete Button */}
                 {documentId !== 'new' && (
                     <button
                         onClick={() => setShowDeleteConfirm(true)}
                         disabled={isDeleting}
                         className="p-1 rounded-lg transition-all bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:border-red-300"
                         title="Delete document"
                         suppressHydrationWarning
                     >
                         <Trash2 className="w-3 h-3" />
                     </button>
                 )}

                <div className="w-px h-6 bg-gray-300"></div>

                                 {/* Font Family */}
                 <select
                     value={fontFamilies.find(f => f.value === formatState.fontFamily)?.value || 'Arial, sans-serif'}
                     onChange={(e) => handleFormat('fontFamily', e.target.value)}
                     className="px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                     suppressHydrationWarning
                 >
                     {fontFamilies.map((font) => (
                         <option key={font.value} value={font.value}>{font.name}</option>
                     ))}
                 </select>
 
                 {/* Font Size */}
                 <select
                     value={formatState.fontSize}
                     onChange={(e) => handleFormat('fontSize', e.target.value)}
                     className="px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-12"
                     suppressHydrationWarning
                 >
                     {fontSizes.map((size) => (
                         <option key={size} value={size}>{size}</option>
                     ))}
                 </select>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Text Formatting */}
                <button
                    onClick={() => handleFormat('bold')}
                    className={`p-1.5 rounded transition-colors ${formatState.bold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Bold (Ctrl+B)"
                    suppressHydrationWarning
                >
                    <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => handleFormat('italic')}
                    className={`p-1.5 rounded transition-colors ${formatState.italic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Italic (Ctrl+I)"
                    suppressHydrationWarning
                >
                    <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => handleFormat('underline')}
                    className={`p-1.5 rounded transition-colors ${formatState.underline ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Underline (Ctrl+U)"
                    suppressHydrationWarning
                >
                    <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => handleFormat('strikeThrough')}
                    className={`p-1.5 rounded transition-colors ${formatState.strikethrough ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Strikethrough"
                    suppressHydrationWarning
                >
                    <Strikethrough className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Text Color */}
                <div className="relative" ref={colorPickerRef}>
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors group relative flex flex-col items-center gap-1"
                        title="Text Color"
                        suppressHydrationWarning
                    >
                        <Palette className="w-3.5 h-3.5 transition-colors" style={{ color: formatState.color }} />
                    </button>
                    
                    {showColorPicker && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px]">
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-700 mb-2">Predefined Colors</label>
                                <div className="grid grid-cols-8 gap-1">
                                    {[
                                        '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                                        '#800000', '#808000', '#008000', '#800080', '#008080', '#000080', '#FFA500', '#FFC0CB',
                                        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
                                        '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#A8E6CF', '#D2B4DE', '#AED6F1'
                                    ].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                handleFormat('foreColor', color)
                                                setShowColorPicker(false)
                                            }}
                                            className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            {/* Simple HTML Color Picker */}
                            <div className="border-t border-gray-200 pt-3">
                                <label className="block text-xs font-medium text-gray-700 mb-2">Custom Color</label>
                                <div className="space-y-3">
                                    {/* HTML Color Input without eyedropper */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={formatState.color}
                                            onChange={(e) => handleFormat('foreColor', e.target.value)}
                                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                                            style={{ 
                                                WebkitAppearance: 'none',
                                                appearance: 'none',
                                                background: 'none',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px'
                                            }}
                                        />
                                        <input
                                            type="text"
                                            value={formatState.color}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                                    handleFormat('foreColor', value)
                                                }
                                            }}
                                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-gray-300"></div>

                                 {/* Headings */}
                 <button
                     onClick={() => handleFormat('formatBlock', 'h1')}
                     className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h1' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                     title="Heading 1"
                     suppressHydrationWarning
                 >
                     H1
                 </button>
                 <button
                     onClick={() => handleFormat('formatBlock', 'h2')}
                     className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h2' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                     title="Heading 2"
                     suppressHydrationWarning
                 >
                     H2
                 </button>
                 <button
                     onClick={() => handleFormat('formatBlock', 'h3')}
                     className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h3' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                     title="Heading 3"
                     suppressHydrationWarning
                 >
                     H3
                 </button>
                 <button
                     onClick={() => handleFormat('formatBlock', 'p')}
                     className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'p' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                     title="Paragraph (Ctrl+0)"
                     suppressHydrationWarning
                 >
                     P
                 </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Lists */}
                <button
                    onClick={() => handleFormat('insertUnorderedList')}
                    className={`p-2 rounded transition-colors ${formatState.listType === 'unordered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Bullet List"
                    suppressHydrationWarning
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('insertOrderedList')}
                    className={`p-2 rounded transition-colors ${formatState.listType === 'ordered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Numbered List"
                    suppressHydrationWarning
                >
                    <ListOrdered className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Alignment */}
                <button
                    onClick={() => handleFormat('justifyLeft')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Align Left"
                    suppressHydrationWarning
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('justifyCenter')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Align Center"
                    suppressHydrationWarning
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('justifyRight')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Align Right"
                    suppressHydrationWarning
                >
                    <AlignRight className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleFormat('justifyFull')}
                    className={`p-2 rounded transition-colors ${formatState.alignment === 'justify' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                    title="Justify"
                    suppressHydrationWarning
                >
                    <AlignJustify className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Special Formats */}
                <button
                    onClick={() => handleFormat('formatBlock', 'blockquote')}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Quote Block"
                    suppressHydrationWarning
                >
                    <Quote className="w-4 h-4 text-gray-600" />
                </button>
                <button
                    onClick={() => handleFormat('formatBlock', 'pre')}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Code Block"
                    suppressHydrationWarning
                >
                    <Code className="w-4 h-4 text-gray-600" />
                </button>
                <button
                    onClick={() => handleFormat('createLink')}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Insert Link (Ctrl+K)"
                    suppressHydrationWarning
                >
                    <Link2 className="w-4 h-4 text-gray-600" />
                </button>
                <button
                    onClick={() => {
                        const insideTable = checkIfInsideTable()
                        setIsInsideTable(insideTable)
                        setShowTableManager(true)
                    }}
                    className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    title="Insert Table"
                    suppressHydrationWarning
                >
                    <Table className="w-4 h-4 text-gray-600" />
                </button>

                <div className="w-px h-6 bg-gray-300"></div>


                {/* AI Chat Toggle */}
                <button
                    onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                    className={`p-2 rounded transition-colors flex-shrink-0 ${
                        isAIChatOpen 
                            ? 'bg-black text-white' 
                            : 'hover:bg-gray-100 text-black'
                    }`}
                    title="Toggle AI Assistant (Ctrl+Shift+L)"
                    suppressHydrationWarning
                >
                    <Feather className="w-4 h-4" />
                </button>

                </div>

            {/* Writing Area */}
            <div 
                className="flex-1 overflow-y-auto editor-content transition-all duration-300 ease-in-out"
                style={{ 
                    marginRight: isAIChatOpen ? `${aiChatWidth}px` : '0px'
                }}
            >
                <div className="max-w-4xl mx-auto p-8 relative">
                    
                    <div
                        ref={editorRef}
                        contentEditable
                        className="min-h-[600px] focus:outline-none max-w-none relative"
                        style={{
                            color: '#000000',
                            lineHeight: '1.6',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '16px'
                        }}
                        onInput={handleContentChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onMouseDown={(e) => {
                            const target = e.target as HTMLElement
                            
                            // Column resize - check if clicking near right edge
                            if (target.tagName === 'TD' || target.tagName === 'TH') {
                                const rect = target.getBoundingClientRect()
                                const mouseX = e.clientX
                                const rightEdge = rect.right
                                
                                // If click is within 8px of the right edge
                                if (mouseX >= rightEdge - 8 && mouseX <= rightEdge + 3) {
                                    startColumnResize(e, target)
                                    return
                                }
                            }
                            
                            // Row resize - check if clicking near bottom edge
                            if (target.tagName === 'TD' || target.tagName === 'TH') {
                                const rect = target.getBoundingClientRect()
                                const mouseY = e.clientY
                                const bottomEdge = rect.bottom
                                
                                // If click is within 8px of the bottom edge
                                if (mouseY >= bottomEdge - 8 && mouseY <= bottomEdge + 3) {
                                    startRowResize(e, target)
                                    return
                                }
                            }
                        }}
                        onClick={(e) => {
                            // Handle image clicks
                            handleImageClick(e)
                            
                            // Update format state for cursor position when clicking on text
                            const target = e.target as HTMLElement
                            if (target.tagName !== 'IMG') {
                                const selection = window.getSelection()
                                if (!selection || selection.toString().length === 0) {
                                    setTimeout(() => updateFormatState(), 0)
                                }
                            }
                        }}
                        onContextMenu={(e) => {
                            // Handle right-click on images to toggle between resize and crop handles
                            handleImageRightClick(e)
                            
                            // Handle table context menu
                            const target = e.target as HTMLElement
                            const tableCell = target.closest('td, th')
                            const table = target.closest('table')
                            
                            if (tableCell && table) {
                                handleTableContextMenu(e, table as HTMLTableElement, tableCell as HTMLTableCellElement)
                            }
                        }}
                        onBlur={() => {
                            // Save content when editor loses focus if there are unsaved changes
                            if (documentId !== 'new' && hasUnsavedChanges && content !== originalContent) {
                                console.log('Saving on blur...')
                                saveDocument(content, false)
                            }
                            
                            // Only reset format state when editor loses focus and no text is selected
                            setTimeout(() => {
                                const selection = window.getSelection()
                                if (!selection || selection.toString().length === 0) {
                                    // Check if cursor is still in editor
                                    if (selection?.anchorNode && !editorRef.current?.contains(selection.anchorNode)) {
                                        resetFormatState()
                                    }
                                }
                            }, 100)
                        }}
                        suppressContentEditableWarning={true}
                        role="textbox"
                        aria-label="Rich text editor"
                        aria-multiline="true"
                    />
                    
                    
                                                                  <style jsx>{`
                          .editor-image {
                              cursor: pointer;
                              border: 2px solid transparent;
                              transition: border-color 0.2s;
                              display: block;
                              max-width: 100%;
                              height: auto;
                          }
                          .editor-image:hover {
                              border-color: #3b82f6;
                          }
                          .editor-image.selected {
                              border-color: #3b82f6;
                              box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
                          }
                          .resize-handle, .crop-handle {
                              position: absolute;
                              z-index: 1000;
                              pointer-events: auto;
                              user-select: none;
                          }
                          .resize-handle {
                              background: #3b82f6 !important;
                              border: 2px solid white !important;
                              box-shadow: 0 0 4px rgba(0,0,0,0.3);
                              transition: transform 0.1s ease;
                          }
                          .crop-handle {
                              background: #ef4444 !important;
                              border: 2px solid white !important;
                              box-shadow: 0 0 4px rgba(0,0,0,0.3);
                          }
                      `}</style>
                </div>
                
                
            </div>

            {/* Bottom Status Bar */}
            <div className="h-8 border-t border-gray-200 bg-gray-50 px-4 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                    <span>{getWordCount()} words</span>
                    <span>{getCharCount()} characters</span>
                    {isSaving && <span className="text-blue-600">Saving...</span>}


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
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                                suppressHydrationWarning
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteDocument}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                suppressHydrationWarning
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
                        onContentChange={onContentChange}
                        onStartAgentTyping={startAgentTyping}
                        onStopAgentTyping={stopAgentTyping}
                    />
                </div>
            )}

            {/* Table Manager */}
            <TableManager
                isOpen={showTableManager}
                onClose={() => setShowTableManager(false)}
                onInsertTable={insertTable}
                isInsideTable={isInsideTable}
            />

            {/* Table Context Menu */}
            <TableContextMenu
                isOpen={tableContextMenu.isOpen}
                position={tableContextMenu.position}
                onClose={() => setTableContextMenu(prev => ({ ...prev, isOpen: false }))}
                onInsertRowAbove={() => insertTableRow('above')}
                onInsertRowBelow={() => insertTableRow('below')}
                onInsertColumnLeft={() => insertTableColumn('left')}
                onInsertColumnRight={() => insertTableColumn('right')}
                onDeleteRow={deleteTableRow}
                onDeleteColumn={deleteTableColumn}
                onDeleteTable={deleteTable}
            />

            </div>
    )
}

