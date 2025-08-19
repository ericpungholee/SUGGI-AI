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
    
    // Image editing state
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)

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
    }, [updateFormatState, resetFormatState])

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
                 <button
                     onClick={() => handleFormat('formatBlock', 'p')}
                     className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'p' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                     title="Paragraph (Ctrl+0)"
                 >
                     P
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
                        onPaste={handlePaste}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
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
                        }}
                        onBlur={() => {
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

