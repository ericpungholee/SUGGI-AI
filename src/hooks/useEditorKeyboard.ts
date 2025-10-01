import { useCallback } from 'react';

export interface UseEditorKeyboardProps {
    onFormat: (command: string, value?: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
    onDelete: () => void;
    onAIToggle: () => void;
    onTableClick: () => void;
    checkIfInsideTable: () => boolean;
    documentId: string;
}

export function useEditorKeyboard({
    onFormat,
    onUndo,
    onRedo,
    onSave,
    onDelete,
    onAIToggle,
    onTableClick,
    checkIfInsideTable,
    documentId
}: UseEditorKeyboardProps) {
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (isCtrl) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    onSave();
                    break;
                case 'delete':
                    if (documentId !== 'new') {
                        e.preventDefault();
                        onDelete();
                    }
                    break;
                case 'b':
                    e.preventDefault();
                    onFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    onFormat('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    onFormat('underline');
                    break;
                case 'k':
                    e.preventDefault();
                    const url = prompt('Enter the URL:');
                    if (url) onFormat('createLink', url);
                    break;
                case 'z':
                    e.preventDefault();
                    if (isShift) {
                        onRedo();
                    } else {
                        onUndo();
                    }
                    break;
                case '0':
                    e.preventDefault();
                    onFormat('formatBlock', 'p');
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    e.preventDefault();
                    const level = e.key;
                    onFormat('formatBlock', `h${level}`);
                    break;
                case 'l':
                    if (isShift) {
                        e.preventDefault();
                        onFormat('insertUnorderedList');
                    } else {
                        e.preventDefault();
                        onFormat('justifyLeft');
                    }
                    break;
                case 'e':
                    e.preventDefault();
                    onFormat('justifyCenter');
                    break;
                case 'r':
                    e.preventDefault();
                    onFormat('justifyRight');
                    break;
                case 'j':
                    e.preventDefault();
                    onFormat('justifyFull');
                    break;
                case 'o':
                    if (isShift) {
                        e.preventDefault();
                        onFormat('insertOrderedList');
                    }
                    break;
                case 'l':
                    if (isShift) {
                        e.preventDefault();
                        onAIToggle();
                    }
                    break;
                case 't':
                    if (isShift) {
                        e.preventDefault();
                        const insideTable = checkIfInsideTable();
                        onTableClick();
                    }
                    break;
            }
        }
        
        // Handle Enter key for line breaks
        if (e.key === 'Enter') {
            // Let the default behavior happen (creates <br> or <div>)
            // Force update line numbers after a short delay
            setTimeout(() => {
                // This could trigger line number updates if needed
            }, 10);
        }
    }, [onFormat, onUndo, onRedo, onSave, onDelete, onAIToggle, onTableClick, checkIfInsideTable, documentId]);

    return {
        handleKeyDown
    };
}
