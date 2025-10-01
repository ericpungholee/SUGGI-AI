import { useCallback } from 'react';
import { FormatState } from '@/types';
import * as formattingUtils from '@/lib/editor/formatting-utils';

export interface UseEditorFormattingProps {
    formatState: FormatState;
    setFormatState: React.Dispatch<React.SetStateAction<FormatState>>;
    saveToUndoStack: (content: string) => void;
    editorRef: React.RefObject<HTMLDivElement>;
    setContent: (content: string) => void;
}

export function useEditorFormatting({
    formatState,
    setFormatState,
    saveToUndoStack,
    editorRef,
    setContent
}: UseEditorFormattingProps) {
    
    // Update format state based on current selection
    const updateFormatState = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement;
        if (!element) return;

        const newFormatState: Partial<FormatState> = {};
        
        // Check if the selection spans multiple elements with different formatting
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        const startElement = startContainer.nodeType === Node.ELEMENT_NODE ? startContainer as Element : startContainer.parentElement;
        const endElement = endContainer.nodeType === Node.ELEMENT_NODE ? endContainer as Element : endContainer.parentElement;
        
        if (!startElement || !endElement) return;
        
        // Check if all selected text has the same formatting
        const startBold = !!startElement.closest('strong, b');
        const endBold = !!endElement.closest('strong, b');
        const startItalic = !!startElement.closest('em, i');
        const endItalic = !!endElement.closest('em, i');
        const startUnderline = !!startElement.closest('u');
        const endUnderline = !!endElement.closest('u');
        const startStrikethrough = !!startElement.closest('s, strike');
        const endStrikethrough = !!endElement.closest('s, strike');
        
        // Only set to true if ALL selected text has the same formatting
        newFormatState.bold = startBold && endBold;
        newFormatState.italic = startItalic && endItalic;
        newFormatState.underline = startUnderline && endUnderline;
        newFormatState.strikethrough = startStrikethrough && endStrikethrough;
        
        // For single elements, check the current element
        if (range.collapsed) {
            newFormatState.bold = !!element.closest('strong, b');
            newFormatState.italic = !!element.closest('em, i');
            newFormatState.underline = !!element.closest('u');
            newFormatState.strikethrough = !!element.closest('s, strike');
        }
        
        newFormatState.subscript = !!element.closest('sub');
        newFormatState.superscript = !!element.closest('sup');
        
        const computedStyle = window.getComputedStyle(element);
        newFormatState.color = computedStyle.color;
        newFormatState.backgroundColor = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computedStyle.backgroundColor : 'transparent';
        newFormatState.fontSize = computedStyle.fontSize;
        newFormatState.fontFamily = computedStyle.fontFamily;
        
        if (element.closest('p, div, h1, h2, h3, h4, h5, h6')) {
            const blockElement = element.closest('p, div, h1, h2, h3, h4, h5, h6') as Element;
            const textAlign = window.getComputedStyle(blockElement).textAlign;
            newFormatState.alignment = textAlign;
        }
        
        if (element.closest('ul')) {
            newFormatState.listType = 'unordered';
        } else if (element.closest('ol')) {
            newFormatState.listType = 'ordered';
        } else {
            newFormatState.listType = 'none';
        }
        
        // Check if the cursor is in a heading or paragraph, or if the selection spans one
        let headingLevel = 'none';
        
        if (range.collapsed) {
            // Cursor position - check current element
            const headingElement = element.closest('h1, h2, h3, h4, h5, h6');
            if (headingElement) {
                headingLevel = headingElement.tagName.toLowerCase();
            } else {
                // Check if cursor is in a paragraph
                const paragraphElement = element.closest('p');
                if (paragraphElement) {
                    headingLevel = 'p';
                }
            }
        } else {
            // Text selection - check if all selected text is in the same block format
            const startBlock = startElement.closest('h1, h2, h3, h4, h5, h6, p');
            const endBlock = endElement.closest('h1, h2, h3, h4, h5, h6, p');
            
            if (startBlock && endBlock && startBlock === endBlock) {
                const tagName = startBlock.tagName.toLowerCase();
                if (tagName === 'p' || tagName.startsWith('h')) {
                    headingLevel = tagName;
                }
            }
        }
        
        newFormatState.headingLevel = headingLevel;
        
        setFormatState(prev => ({ ...prev, ...newFormatState }));
    }, [setFormatState]);

    // Reset format state
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
        }));
    }, [setFormatState]);

    // Handle format command
    const handleFormat = useCallback((command: string, value?: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found, returning');
            return;
        }

        const range = selection.getRangeAt(0);
        if (!range) {
            console.log('No range found, returning');
            return;
        }

        console.log('Applying format:', command, value, 'to range:', range);

        if (editorRef.current) {
            saveToUndoStack(editorRef.current.innerHTML);
        }

        try {
            let success = false;
            
            switch (command) {
                case 'bold':
                    success = formattingUtils.toggleInlineFormat('strong', range);
                    break;
                case 'italic':
                    success = formattingUtils.toggleInlineFormat('em', range);
                    break;
                case 'underline':
                    success = formattingUtils.toggleInlineFormat('u', range);
                    break;
                case 'strikeThrough':
                    success = formattingUtils.toggleInlineFormat('s', range);
                    break;
                case 'subscript':
                    success = formattingUtils.toggleInlineFormat('sub', range);
                    break;
                case 'superscript':
                    success = formattingUtils.toggleInlineFormat('sup', range);
                    break;
                case 'insertUnorderedList':
                    success = formattingUtils.applyListFormat('ul', range);
                    break;
                case 'insertOrderedList':
                    success = formattingUtils.applyListFormat('ol', range);
                    break;
                case 'justifyLeft':
                    success = formattingUtils.applyAlignment('left', range);
                    break;
                case 'justifyCenter':
                    success = formattingUtils.applyAlignment('center', range);
                    break;
                case 'justifyRight':
                    success = formattingUtils.applyAlignment('right', range);
                    break;
                case 'justifyFull':
                    success = formattingUtils.applyAlignment('justify', range);
                    break;
                case 'formatBlock':
                    if (value) {
                        success = formattingUtils.toggleBlockFormat(value, range);
                    }
                    break;
                case 'createLink':
                    if (value) {
                        success = formattingUtils.applyLinkFormat(value, range);
                    }
                    break;
                case 'backColor':
                    if (value) {
                        success = formattingUtils.applyBackgroundColor(value, range);
                    }
                    break;
                case 'foreColor':
                    if (value) {
                        success = formattingUtils.applyTextColor(value, range);
                    }
                    break;
                case 'fontSize':
                    if (value) {
                        success = formattingUtils.applyFontSize(value, range);
                    }
                    break;
                case 'fontFamily':
                    if (value) {
                        success = formattingUtils.applyFontFamily(value, range);
                    }
                    break;
                case 'insertTable':
                    // This would trigger table manager - handled by parent
                    success = true;
                    break;
            }
            
            if (success) {
                if (editorRef.current) {
                    const newContent = editorRef.current.innerHTML;
                    setContent(newContent);
                    
                    // Restore focus and selection after format change
                    setTimeout(() => {
                        editorRef.current?.focus();
                        // Try to restore selection if it was lost
                        if (selection.rangeCount === 0) {
                            const newSelection = window.getSelection();
                            if (newSelection && editorRef.current) {
                                const newRange = document.createRange();
                                newRange.selectNodeContents(editorRef.current);
                                newRange.collapse(false); // Collapse to end
                                newSelection.removeAllRanges();
                                newSelection.addRange(newRange);
                            }
                        }
                    }, 10);
                }
                updateFormatState();
            }
            
        } catch (error) {
            console.error('Error applying format:', error);
        }
    }, [saveToUndoStack, updateFormatState, editorRef, setContent]);

    return {
        updateFormatState,
        resetFormatState,
        handleFormat
    };
}
