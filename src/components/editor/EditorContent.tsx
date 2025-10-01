'use client'
import { useRef, useEffect, useCallback } from 'react';

interface EditorContentProps {
    editorRef: React.RefObject<HTMLDivElement>;
    formatState: {
        fontSize: string;
    };
    onContentChange: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onPaste: (e: React.ClipboardEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onBlur: () => void;
    onImageClick: (e: React.MouseEvent) => void;
    onImageRightClick: (e: React.MouseEvent) => void;
    updateFormatState: () => void;
    resetFormatState: () => void;
    mounted: boolean;
}

export default function EditorContent({
    editorRef,
    formatState,
    onContentChange,
    onKeyDown,
    onPaste,
    onDrop,
    onDragOver,
    onMouseDown,
    onClick,
    onContextMenu,
    onBlur,
    onImageClick,
    onImageRightClick,
    updateFormatState,
    resetFormatState,
    mounted
}: EditorContentProps) {
    
    // Add selection change listener
    useEffect(() => {
        if (!mounted) return;
        
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.toString().length > 0 || range.collapsed) {
                    // Update format state for both selections and cursor position
                    // Add a small delay to ensure DOM is stable
                    setTimeout(() => updateFormatState(), 0);
                } else {
                    // Reset format state when no text is selected and cursor is not in editor
                    if (!editorRef.current?.contains(selection.anchorNode)) {
                        resetFormatState();
                    }
                }
            } else {
                // Reset format state when no selection
                resetFormatState();
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [updateFormatState, resetFormatState, mounted, editorRef]);

    if (!mounted) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing editor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto editor-content transition-all duration-300 ease-in-out">
            <div className="relative">
                {/* Editor Content */}
                <div className="p-8 max-w-4xl mx-auto">
                    <div
                        ref={editorRef}
                        contentEditable
                        className="min-h-[600px] focus:outline-none max-w-none relative"
                        style={{
                            color: '#000000',
                            lineHeight: `${parseInt(formatState.fontSize) * 1.6}px`,
                            fontFamily: 'Arial, sans-serif',
                            fontSize: formatState.fontSize,
                            margin: 0,
                            padding: 0,
                            minHeight: '0px'
                        }}
                        onInput={onContentChange}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onMouseDown={onMouseDown}
                        onClick={(e) => {
                            // Handle image clicks
                            onImageClick(e);
                            
                            // Update format state for cursor position when clicking on text
                            const target = e.target as HTMLElement;
                            if (target.tagName !== 'IMG') {
                                const selection = window.getSelection();
                                if (!selection || selection.toString().length === 0) {
                                    setTimeout(() => updateFormatState(), 0);
                                }
                            }
                        }}
                        onContextMenu={(e) => {
                            // Handle right-click on images to toggle between resize and crop handles
                            onImageRightClick(e);
                            
                            // Handle table context menu
                            const target = e.target as HTMLElement;
                            const tableCell = target.closest('td, th');
                            const table = target.closest('table');
                            
                            if (tableCell && table) {
                                // This would be handled by the parent component
                                // handleTableContextMenu(e, table as HTMLTableElement, tableCell as HTMLTableCellElement);
                            }
                        }}
                        onBlur={() => {
                            // Save content when editor loses focus if there are unsaved changes
                            // This would be handled by the parent component
                            onBlur();
                            
                            // Only reset format state when editor loses focus and no text is selected
                            setTimeout(() => {
                                const selection = window.getSelection();
                                if (!selection || selection.toString().length === 0) {
                                    // Check if cursor is still in editor
                                    if (selection?.anchorNode && !editorRef.current?.contains(selection.anchorNode)) {
                                        resetFormatState();
                                    }
                                }
                            }, 100);
                        }}
                        suppressContentEditableWarning={true}
                        role="textbox"
                        aria-label="Rich text editor"
                        aria-multiline="true"
                    >
                    </div>
                </div>
            </div>
            
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
    );
}
