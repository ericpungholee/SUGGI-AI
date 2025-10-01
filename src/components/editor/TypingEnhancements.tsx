'use client'
import { useEffect, useRef } from 'react'

interface TypingEnhancementsProps {
    editorRef: React.RefObject<HTMLDivElement>
}

export default function TypingEnhancements({ editorRef }: TypingEnhancementsProps) {
    const lastSelectionRef = useRef<Selection | null>(null)
    const isComposingRef = useRef(false)

    useEffect(() => {
        if (!editorRef.current) return

        const editor = editorRef.current

        // Enhanced cursor handling
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            if (selection && editor.contains(selection.anchorNode)) {
                lastSelectionRef.current = selection
                
                // Add smooth cursor animation
                const range = selection.getRangeAt(0)
                if (range.collapsed) {
                    // Cursor is positioned, add visual enhancements
                    const cursorElement = document.createElement('div')
                    cursorElement.className = 'enhanced-cursor'
                    cursorElement.style.cssText = `
                        position: absolute;
                        width: 2px;
                        height: 1.2em;
                        background: #4285f4;
                        animation: blink 1s infinite;
                        pointer-events: none;
                        z-index: 1000;
                    `
                }
            }
        }

        // Handle composition events for better IME support
        const handleCompositionStart = () => {
            isComposingRef.current = true
        }

        const handleCompositionEnd = () => {
            isComposingRef.current = false
        }

        // Enhanced text selection
        const handleMouseUp = () => {
            setTimeout(() => {
                const selection = window.getSelection()
                if (selection && selection.toString().length > 0) {
                    // Add selection highlight
                    const range = selection.getRangeAt(0)
                    const rect = range.getBoundingClientRect()
                    
                    // Create selection tooltip
                    if (rect.width > 0 && rect.height > 0) {
                        const tooltip = document.createElement('div')
                        tooltip.className = 'selection-tooltip'
                        tooltip.style.cssText = `
                            position: fixed;
                            top: ${rect.top - 40}px;
                            left: ${rect.left + rect.width / 2}px;
                            transform: translateX(-50%);
                            background: #333;
                            color: white;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 12px;
                            z-index: 1000;
                            pointer-events: none;
                            opacity: 0;
                            transition: opacity 0.2s;
                        `
                        tooltip.textContent = `${selection.toString().length} characters selected`
                        
                        document.body.appendChild(tooltip)
                        
                        // Fade in
                        setTimeout(() => {
                            tooltip.style.opacity = '1'
                        }, 10)
                        
                        // Remove after delay
                        setTimeout(() => {
                            tooltip.style.opacity = '0'
                            setTimeout(() => {
                                if (tooltip.parentNode) {
                                    tooltip.parentNode.removeChild(tooltip)
                                }
                            }, 200)
                        }, 2000)
                    }
                }
            }, 10)
        }

        // Smart paste handling
        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault()
            
            const clipboardData = e.clipboardData
            if (!clipboardData) return

            const htmlData = clipboardData.getData('text/html')
            const textData = clipboardData.getData('text/plain')

            if (htmlData && htmlData.includes('<table')) {
                // Handle table paste specially
                const selection = window.getSelection()
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    range.deleteContents()
                    
                    // Clean and insert table HTML
                    const tempDiv = document.createElement('div')
                    tempDiv.innerHTML = htmlData
                    const table = tempDiv.querySelector('table')
                    
                    if (table) {
                        // Style the table to match editor
                        table.style.cssText = `
                            border-collapse: collapse;
                            width: 100%;
                            margin: 16px 0;
                        `
                        
                        // Style cells
                        const cells = table.querySelectorAll('td, th')
                        cells.forEach(cell => {
                            if (cell instanceof HTMLElement) {
                                cell.style.cssText = `
                                    border: 1px solid #ddd;
                                    padding: 8px;
                                    text-align: left;
                                `
                            }
                        })
                        
                        range.insertNode(table)
                        range.collapse(false)
                    }
                }
            } else {
                // Regular text paste
                const selection = window.getSelection()
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    range.deleteContents()
                    
                    const textNode = document.createTextNode(textData)
                    range.insertNode(textNode)
                    range.setStartAfter(textNode)
                    range.collapse(false)
                }
            }
            
            // Update selection
            if (window.getSelection()) {
                window.getSelection()?.removeAllRanges()
                const newRange = document.createRange()
                newRange.collapse(false)
                window.getSelection()?.addRange(newRange)
            }
        }

        // Enhanced keyboard navigation
        const handleKeyDown = (e: KeyboardEvent) => {
            // Handle smart paragraph breaks
            if (e.key === 'Enter' && !e.shiftKey) {
                const selection = window.getSelection()
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    const container = range.commonAncestorContainer
                    const blockElement = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement
                    
                    if (blockElement) {
                        const closestBlock = blockElement.closest('p, div, h1, h2, h3, h4, h5, h6')
                        if (closestBlock && closestBlock.textContent?.trim() === '') {
                            // Empty paragraph, don't create another
                            e.preventDefault()
                            return
                        }
                    }
                }
            }

            // Handle smart list continuation
            if (e.key === 'Enter' && !e.shiftKey) {
                const selection = window.getSelection()
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    const container = range.commonAncestorContainer
                    const listItem = container instanceof Element ? container.closest('li') : null
                    
                    if (listItem) {
                        const list = listItem.closest('ul, ol')
                        if (list && range.collapsed && range.startOffset === listItem.textContent?.length) {
                            // At end of list item, continue list
                            setTimeout(() => {
                                const newRange = document.createRange()
                                newRange.setStartAfter(listItem)
                                newRange.collapse(true)
                                
                                const newListItem = document.createElement('li')
                                newListItem.innerHTML = '<br>'
                                newRange.insertNode(newListItem)
                                
                                const newRange2 = document.createRange()
                                newRange2.setStart(newListItem, 0)
                                newRange2.collapse(true)
                                
                                selection.removeAllRanges()
                                selection.addRange(newRange2)
                            }, 0)
                        }
                    }
                }
            }
        }

        // Add event listeners
        document.addEventListener('selectionchange', handleSelectionChange)
        editor.addEventListener('mouseup', handleMouseUp)
        editor.addEventListener('paste', handlePaste)
        editor.addEventListener('compositionstart', handleCompositionStart)
        editor.addEventListener('compositionend', handleCompositionEnd)
        editor.addEventListener('keydown', handleKeyDown)

        // Add CSS animations
        const style = document.createElement('style')
        style.textContent = `
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }
            
            .enhanced-cursor {
                position: absolute;
                width: 2px;
                height: 1.2em;
                background: #4285f4;
                animation: blink 1s infinite;
                pointer-events: none;
                z-index: 1000;
            }
            
            /* Enhanced selection styling */
            ::selection {
                background: #4285f4;
                color: white;
            }
            
            ::-moz-selection {
                background: #4285f4;
                color: white;
            }
        `
        document.head.appendChild(style)

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange)
            editor.removeEventListener('mouseup', handleMouseUp)
            editor.removeEventListener('paste', handlePaste)
            editor.removeEventListener('compositionstart', handleCompositionStart)
            editor.removeEventListener('compositionend', handleCompositionEnd)
            editor.removeEventListener('keydown', handleKeyDown)
            
            if (style.parentNode) {
                style.parentNode.removeChild(style)
            }
        }
    }, [editorRef])

    return null
}
