/**
 * Editor Formatting Utilities
 * Contains all the formatting logic for the rich text editor
 */

export const toggleInlineFormat = (tagName: string, range: Range): boolean => {
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

export const toggleInlineFormatManual = (tagName: string, range: Range): boolean => {
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

export const removeInlineFormat = (tagName: string, formattingElement: Element, range: Range): boolean => {
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

export const applyInlineFormatManual = (tagName: string, range: Range): boolean => {
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

export const applyInlineFormat = (tagName: string, range: Range): boolean => {
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

export const toggleBlockFormat = (tagName: string, range: Range): boolean => {
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

export const applyBlockFormatToSelection = (tagName: string, range: Range): boolean => {
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

export const handlePartialBlockSelection = (tagName: string, blockElement: Element, range: Range): boolean => {
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

export const splitBlockAndApplyFormat = (tagName: string, blockElement: Element, range: Range): boolean => {
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

export const convertCurrentBlock = (tagName: string, range: Range): boolean => {
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

export const wrapSelectionInBlock = (tagName: string, range: Range): boolean => {
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

export const cleanupEmptyBlocks = (range: Range): void => {
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

export const applyListFormat = (listType: string, range: Range): boolean => {
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

export const applyAlignment = (alignment: string, range: Range): boolean => {
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

export const applyLinkFormat = (url: string, range: Range): boolean => {
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

export const applyBackgroundColor = (color: string, range: Range): boolean => {
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

export const applyTextColor = (color: string, range: Range): boolean => {
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

export const applyFontSize = (size: string, range: Range): boolean => {
    try {
        console.log('Applying font size:', size, 'to selected range only')
        
        if (range.collapsed) {
            // Handle collapsed range (cursor position) - only apply to the immediate text node
            console.log('Handling collapsed range - cursor position')
            const container = range.commonAncestorContainer
            
            if (container.nodeType === Node.TEXT_NODE) {
                const textNode = container as Text
                const span = document.createElement('span')
                span.style.fontSize = size
                textNode.parentNode?.insertBefore(span, textNode)
                span.appendChild(textNode)
                console.log('Wrapped text node in span with font size')
                return true
            } else {
                // For collapsed range on element, don't apply to the entire element
                // Instead, create a span at the cursor position
                const span = document.createElement('span')
                span.style.fontSize = size
                span.innerHTML = '&nbsp;' // Add a non-breaking space to maintain cursor position
                range.insertNode(span)
                // Move cursor after the inserted span
                range.setStartAfter(span)
                range.setEndAfter(span)
                console.log('Created span at cursor position with font size')
                return true
            }
        }

        // Handle non-collapsed range (text selection) - only apply to selected text
        console.log('Handling non-collapsed range - text selection only')
        
        // Extract only the selected text content
        const selectedText = range.toString()
        if (!selectedText.trim()) {
            console.log('No text selected, skipping font size change')
            return false
        }

        try {
            // First try to surround only the selected content
            const span = document.createElement('span')
            span.style.fontSize = size
            range.surroundContents(span)
            console.log('Successfully surrounded selected text with font size')
            return true
        } catch (surroundError) {
            console.log('surroundContents failed, using precise text node approach:', surroundError)
            
            // Get only the text nodes that are actually selected
            const textNodes: Text[] = []
            const walker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const textNode = node as Text
                            // Check if this text node is actually within the selection range
                            try {
                                const nodeRange = document.createRange()
                                nodeRange.selectNode(textNode)
                                
                                // More precise check: only include nodes that are actually selected
                                const startComparison = range.compareBoundaryPoints(Range.START_TO_END, nodeRange)
                                const endComparison = range.compareBoundaryPoints(Range.END_TO_START, nodeRange)
                                
                                // Node is selected if range starts before/at node end and range ends after/at node start
                                return startComparison >= 0 && endComparison <= 0
                                       ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                            } catch (e) {
                                return NodeFilter.FILTER_REJECT
                            }
                        }
                        return NodeFilter.FILTER_REJECT
                    }
                }
            )

            let node
            while (node = walker.nextNode()) {
                textNodes.push(node as Text)
            }

            console.log('Found selected text nodes:', textNodes.length)

            if (textNodes.length === 0) {
                console.log('No text nodes found in selection, cannot apply font size')
                return false
            }

            // For each selected text node, wrap it in a span with the font size
            // But be more precise about what gets wrapped
            textNodes.forEach((textNode, index) => {
                if (textNode.textContent && textNode.textContent.trim()) {
                    // Check if this text node is fully selected or partially selected
                    try {
                        const nodeRange = document.createRange()
                        nodeRange.selectNode(textNode)
                        
                        // If the node is fully within the selection range, wrap the whole node
                        if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0 &&
                            range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0) {
                            
                            const span = document.createElement('span')
                            span.style.fontSize = size
                            textNode.parentNode?.insertBefore(span, textNode)
                            span.appendChild(textNode)
                            console.log(`Wrapped full text node ${index + 1} in span with font size`)
                        } else {
                            // Node is partially selected, we need to split it
                            console.log(`Text node ${index + 1} is partially selected, splitting...`)
                            // For now, wrap the whole node - this could be improved with more precise splitting
                            const span = document.createElement('span')
                            span.style.fontSize = size
                            textNode.parentNode?.insertBefore(span, textNode)
                            span.appendChild(textNode)
                            console.log(`Wrapped partial text node ${index + 1} in span with font size`)
                        }
                    } catch (e) {
                        console.error(`Error processing text node ${index + 1}:`, e)
                    }
                }
            })

            return true
        }
    } catch (error) {
        console.error('Failed to apply font size to selection:', error)
        return false
    }
}

export const applyFontFamily = (family: string, range: Range): boolean => {
    try {
        console.log('Applying font family:', family, 'to range:', range)
        
        if (range.collapsed) {
            // Handle collapsed range (cursor position)
            console.log('Handling collapsed range for font family')
            const container = range.commonAncestorContainer
            
            if (container.nodeType === Node.TEXT_NODE) {
                const textNode = container as Text
                const span = document.createElement('span')
                span.style.fontFamily = family
                textNode.parentNode?.insertBefore(span, textNode)
                span.appendChild(textNode)
                console.log('Wrapped text node in span with font family')
            } else if (container.nodeType === Node.ELEMENT_NODE) {
                (container as HTMLElement).style.fontFamily = family
                console.log('Applied font family to element')
            }
            return true
        }

        // Handle non-collapsed range (text selection)
        console.log('Handling non-collapsed range for font family')
        
        try {
            // First try to surround the entire range
            const span = document.createElement('span')
            span.style.fontFamily = family
            range.surroundContents(span)
            console.log('Successfully surrounded range contents with font family')
            return true
        } catch (surroundError) {
            console.log('surroundContents failed for font family, using tree walker approach:', surroundError)
            
            // Get all text nodes within the range
            const textNodes: Text[] = []
            const walker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const textNode = node as Text
                            // Check if this text node intersects with our range
                            const nodeRange = document.createRange()
                            try {
                                nodeRange.selectNode(textNode)
                                return range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0 &&
                                       range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0
                                       ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                            } catch (e) {
                                return NodeFilter.FILTER_REJECT
                            }
                        }
                        return NodeFilter.FILTER_REJECT
                    }
                }
            )

            let node
            while (node = walker.nextNode()) {
                textNodes.push(node as Text)
            }

            console.log('Found text nodes for font family:', textNodes.length)

            if (textNodes.length === 0) {
                // No text nodes found, try to apply to container
                const container = range.commonAncestorContainer
                if (container.nodeType === Node.ELEMENT_NODE) {
                    (container as HTMLElement).style.fontFamily = family
                    console.log('Applied font family to container element')
                }
                return true
            }

            // Wrap each text node in a span with the font family
            textNodes.forEach((textNode, index) => {
                if (textNode.textContent && textNode.textContent.trim()) {
                    const span = document.createElement('span')
                    span.style.fontFamily = family
                    
                    // Insert the span before the text node and move the text node into it
                    textNode.parentNode?.insertBefore(span, textNode)
                    span.appendChild(textNode)
                    console.log(`Wrapped text node ${index + 1} in span with font family`)
                }
            })

            return true
        }
    } catch (error) {
        console.error('Failed to apply font family:', error)
        return false
    }
}