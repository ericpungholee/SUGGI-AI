'use client'
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import AIChatPanel from './AIChatPanel';
import TableManager, { TableContextMenu } from './TableManager';
import AgentTextManager from './AgentTextManager';
import EditorToolbar from './EditorToolbar';
import EditorContent from './EditorContent';
import EditorStatusBar from './EditorStatusBar';
import DeleteConfirmModal from './DeleteConfirmModal';
import { useEditorState } from '@/hooks/useEditorState';
import { useEditorFormatting } from '@/hooks/useEditorFormatting';
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard';
import { useTableOperations } from '@/hooks/useTableOperations';
import { useImageOperations } from '@/hooks/useImageOperations';
import { useAgentOperations } from '@/hooks/useAgentOperations';
import './table-styles.css';

export default function Editor({ 
  documentId, 
  onContentChange
}: { 
  documentId: string; 
  onContentChange?: (content: string) => void;
}) {
    const router = useRouter();
    
    // AI Chat Panel state
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [aiChatWidth, setAiChatWidth] = useState(400);
    
    // Delete confirmation state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use custom hooks for different functionalities
    const editorState = useEditorState({ documentId, onContentChange });
    const formatting = useEditorFormatting({
        formatState: editorState.formatState,
        setFormatState: editorState.setFormatState,
        saveToUndoStack: editorState.saveToUndoStack,
        editorRef: editorState.editorRef,
        setContent: editorState.setContent
    });
    
    const tableOps = useTableOperations({
        editorRef: editorState.editorRef,
        saveToUndoStack: editorState.saveToUndoStack,
        setContent: editorState.setContent,
        updateFormatState: formatting.updateFormatState
    });
    
    const keyboard = useEditorKeyboard({
        onFormat: formatting.handleFormat,
        onUndo: editorState.undo,
        onRedo: editorState.redo,
        onSave: editorState.handleManualSave,
        onDelete: () => setShowDeleteConfirm(true),
        onAIToggle: () => setIsAIChatOpen(!isAIChatOpen),
        onTableClick: () => {
            const insideTable = tableOps.checkIfInsideTable();
            tableOps.setIsInsideTable(insideTable);
            tableOps.setShowTableManager(true);
        },
        checkIfInsideTable: tableOps.checkIfInsideTable,
        documentId
    });
    
    const imageOps = useImageOperations({
        editorRef: editorState.editorRef,
        saveToUndoStack: editorState.saveToUndoStack
    });
    
    const agentOps = useAgentOperations({
        editorRef: editorState.editorRef,
        onContentChange
    });

    // Handle navigation
    const handleNavigation = useCallback((url: string) => {
        router.push(url);
    }, [router]);

    // Delete document function
    const handleDeleteDocument = useCallback(async () => {
        if (documentId === 'new') return;
        
        try {
            setIsDeleting(true);
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                // Redirect to home page after successful deletion
                router.push('/home');
            } else {
                const errorData = await response.json();
                // You could show an error toast here
            }
        } catch (error) {
            // You could show an error toast here
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    }, [documentId, router]);

    // Handle title blur for saving
    const handleTitleBlur = useCallback(() => {
        if (documentId !== 'new' && editorState.documentTitle.trim()) {
            // Save title change
            editorState.setIsSavingTitle(true);
            const currentContent = editorState.editorRef.current?.innerHTML || editorState.content;
            editorState.saveDocument(currentContent, false).then(() => {
                // Update original content and title to reflect saved state
                editorState.setOriginalContent(currentContent);
                editorState.setOriginalTitle(editorState.documentTitle.trim());
                editorState.setHasUnsavedChanges(false);
            }).catch(error => {
                console.error('Failed to save title:', error);
                editorState.setSaveError('Failed to save title');
            }).finally(() => {
                editorState.setIsSavingTitle(false);
            });
        }
    }, [documentId, editorState]);

    // Handle editor blur for auto-save
    const handleEditorBlur = useCallback(() => {
        // Save content when editor loses focus if there are unsaved changes
        if (documentId !== 'new' && editorState.hasUnsavedChanges && editorState.content !== editorState.originalContent) {
            console.log('Saving on blur...');
            editorState.saveDocument(editorState.content, false);
        }
        
        // Only reset format state when editor loses focus and no text is selected
        setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.toString().length === 0) {
                // Check if cursor is still in editor
                if (selection?.anchorNode && !editorState.editorRef.current?.contains(selection.anchorNode)) {
                    formatting.resetFormatState();
                }
            }
        }, 100);
    }, [documentId, editorState, formatting]);

    // Close modals when clicking outside
    useEffect(() => {
        if (!editorState.mounted) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (showDeleteConfirm && !(event.target as Element).closest('.delete-modal-container')) {
                setShowDeleteConfirm(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDeleteConfirm, editorState.mounted]);

    // Show loading state
    if (editorState.isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading document...</p>
                </div>
            </div>
        );
    }

    // Don't render editor until mounted to prevent hydration mismatch
    if (!editorState.mounted) {
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
        <div className="flex-1 flex flex-col h-full">
                {/* Fixed Toolbar */}
                <EditorToolbar
                    formatState={editorState.formatState}
                    onFormat={formatting.handleFormat}
                    onUndo={editorState.undo}
                    onRedo={editorState.redo}
                    canUndo={editorState.undoStack.length > 1}
                    canRedo={editorState.redoStack.length > 0}
                    onBack={() => handleNavigation("/home")}
                    onSave={editorState.handleManualSave}
                    onDelete={() => setShowDeleteConfirm(true)}
                    onAIToggle={() => setIsAIChatOpen(!isAIChatOpen)}
                    onTableClick={() => {
                        const insideTable = tableOps.checkIfInsideTable();
                        tableOps.setIsInsideTable(insideTable);
                        tableOps.setShowTableManager(true);
                    }}
                    documentTitle={editorState.documentTitle}
                    onTitleChange={editorState.setDocumentTitle}
                    onTitleBlur={handleTitleBlur}
                    isSaving={editorState.isSaving}
                    justSaved={editorState.justSaved}
                    hasUnsavedChanges={editorState.hasUnsavedChanges}
                    documentId={documentId}
                    isSavingTitle={editorState.isSavingTitle}
                    saveError={editorState.saveError}
                />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-row overflow-hidden">
                    {/* Editor Content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Writing Area */}
                        <div className="flex-1 overflow-y-auto editor-content">
                    <EditorContent
                        editorRef={editorState.editorRef}
                        formatState={editorState.formatState}
                        onContentChange={editorState.handleContentChange}
                        onKeyDown={keyboard.handleKeyDown}
                        onPaste={imageOps.handlePaste}
                        onDrop={imageOps.handleDrop}
                        onDragOver={imageOps.handleDragOver}
                        onMouseDown={(e) => {
                            const target = e.target as HTMLElement;
                            
                            // Column resize - check if clicking near right edge
                            if (target.tagName === 'TD' || target.tagName === 'TH') {
                                const rect = target.getBoundingClientRect();
                                const mouseX = e.clientX;
                                const rightEdge = rect.right;
                                
                                // If click is within 8px of the right edge
                                if (mouseX >= rightEdge - 8 && mouseX <= rightEdge + 3) {
                                    // This would need to be implemented in table operations
                                    // startColumnResize(e, target);
                                    return;
                                }
                            }
                            
                            // Row resize - check if clicking near bottom edge
                            if (target.tagName === 'TD' || target.tagName === 'TH') {
                                const rect = target.getBoundingClientRect();
                                const mouseY = e.clientY;
                                const bottomEdge = rect.bottom;
                                
                                // If click is within 8px of the bottom edge
                                if (mouseY >= bottomEdge - 8 && mouseY <= bottomEdge + 3) {
                                    // This would need to be implemented in table operations
                                    // startRowResize(e, target);
                                    return;
                                }
                            }
                        }}
                        onClick={imageOps.handleImageClick}
                        onContextMenu={(e) => {
                            // Handle right-click on images to toggle between resize and crop handles
                            imageOps.handleImageRightClick(e);
                            
                            // Handle table context menu
                            const target = e.target as HTMLElement;
                            const tableCell = target.closest('td, th');
                            const table = target.closest('table');
                            
                            if (tableCell && table) {
                                tableOps.handleTableContextMenu(e, table as HTMLTableElement, tableCell as HTMLTableCellElement);
                            }
                        }}
                        onBlur={handleEditorBlur}
                        onImageClick={imageOps.handleImageClick}
                        onImageRightClick={imageOps.handleImageRightClick}
                        updateFormatState={formatting.updateFormatState}
                        resetFormatState={formatting.resetFormatState}
                        mounted={editorState.mounted}
                    />
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <DeleteConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteDocument}
                documentTitle={editorState.documentTitle}
                isDeleting={isDeleting}
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
                        onContentChange={onContentChange}
                        onStartAgentTyping={agentOps.startAgentTyping}
                        onStopAgentTyping={agentOps.stopAgentTyping}
                        editorAgent={agentOps.editorAgent}
                        editorRef={editorState.editorRef}
                    />
                </div>
            )}

            {/* Agentic Editing Components */}
            <AgentTextManager
                editorRef={editorState.editorRef}
                agentBlocks={agentOps.agentBlocks}
                currentBlock={agentOps.currentAgentBlock}
                isTyping={agentOps.isAgentTyping}
                typingProgress={agentOps.agentTypingProgress}
                onTextInserted={agentOps.handleAgentTextInserted}
                onTextRemoved={agentOps.handleAgentTextRemoved}
            />


            {/* Table Manager */}
            <TableManager
                isOpen={tableOps.showTableManager}
                onClose={() => tableOps.setShowTableManager(false)}
                onInsertTable={tableOps.insertTable}
                isInsideTable={tableOps.isInsideTable}
            />

            {/* Table Context Menu */}
            <TableContextMenu
                isOpen={tableOps.tableContextMenu.isOpen}
                position={tableOps.tableContextMenu.position}
                onClose={() => tableOps.setTableContextMenu(prev => ({ ...prev, isOpen: false }))}
                onInsertRowAbove={() => tableOps.insertTableRow('above')}
                onInsertRowBelow={() => tableOps.insertTableRow('below')}
                onInsertColumnLeft={() => tableOps.insertTableColumn('left')}
                onInsertColumnRight={() => tableOps.insertTableColumn('right')}
                onDeleteRow={tableOps.deleteTableRow}
                onDeleteColumn={tableOps.deleteTableColumn}
                onDeleteTable={tableOps.deleteTable}
            />

                        {/* Bottom Status Bar */}
                        <EditorStatusBar
                            wordCount={editorState.getWordCount()}
                            charCount={editorState.getCharCount()}
                            isSaving={editorState.isSaving}
                            saveError={editorState.saveError}
                            documentId={documentId}
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
                                onApplyChanges={onContentChange}
                                onRevertChanges={() => {}}
                                connectedDocuments={[]}
                            />
                        </div>
                    )}
                </div>
        </div>
    );
}
