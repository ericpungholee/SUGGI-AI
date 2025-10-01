import { useState, useRef, useCallback, useEffect } from 'react';
import { FormatState } from '@/types';

export interface UseEditorStateProps {
    documentId: string;
    onContentChange?: (content: string) => void;
}

export function useEditorState({ documentId, onContentChange }: UseEditorStateProps) {
    // Content state
    const [content, setContent] = useState('<p>Start writing your document here...</p>');
    const [originalContent, setOriginalContent] = useState('');
    
    // Format state
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
    });
    
    // Editor refs and state
    const editorRef = useRef<HTMLDivElement>(null!);
    const isUpdatingContentRef = useRef(false);
    
    // Undo/Redo state
    const [undoStack, setUndoStack] = useState<string[]>([]);
    const [redoStack, setRedoStack] = useState<string[]>([]);
    const [isUndoRedo, setIsUndoRedo] = useState(false);
    
    // Document state
    const [documentTitle, setDocumentTitle] = useState('Untitled Document');
    const [originalTitle, setOriginalTitle] = useState('Untitled Document');
    
    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [isSavingTitle, setIsSavingTitle] = useState(false);
    
    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    
    // User typing state
    const [isUserTyping, setIsUserTyping] = useState(false);
    
    // Agent typing state
    const [isAgentTyping, setIsAgentTyping] = useState(false);

    // Prevent hydration mismatch by only running on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Initialize editor content
    useEffect(() => {
        if (!mounted) return;
        
        console.log('Initializing editor with documentId:', documentId);
        
        if (documentId === 'new') {
            // For new documents, use default content
            console.log('Setting up new document');
            setDocumentTitle('Untitled Document');
            setOriginalTitle('Untitled Document');
            if (editorRef.current) {
                editorRef.current.innerHTML = content;
                setUndoStack([content]);
                setOriginalContent(content);
            }
        } else {
            // Load existing document content
            loadDocumentContent();
        }
    }, [documentId, mounted]);

    // Load document content from API
    const loadDocumentContent = useCallback(async () => {
        if (!mounted) return;
        
        console.log('📥 Loading document content for ID:', documentId);
        
        try {
            setIsLoading(true);
            const response = await fetch(`/api/documents/${documentId}`);
            
            console.log('📥 API response status:', response.status);
            
            if (response.ok) {
                const document = await response.json();
                console.log('📥 Document loaded from API:', {
                    id: document.id,
                    title: document.title,
                    hasContent: !!document.content,
                    contentType: typeof document.content
                });
                
                // Handle content that might be JSON or string
                let documentContent = '<p>Start writing your document here...</p>';
                if (document.content) {
                    console.log('🔍 Loading document content:', {
                        contentType: typeof document.content,
                        content: document.content,
                        hasHtml: document.content?.html ? 'yes' : 'no',
                        hasPlainText: document.content?.plainText ? 'yes' : 'no'
                    });
                    
                    if (typeof document.content === 'string') {
                        // Legacy string content
                        documentContent = document.content;
                    } else if (typeof document.content === 'object' && document.content !== null) {
                        // Modern JSON content structure
                        if (document.content.html) {
                            documentContent = document.content.html;
                        } else if (document.content.plainText) {
                            // If no HTML but we have plain text, wrap it in a paragraph
                            documentContent = `<p>${document.content.plainText}</p>`;
                        } else {
                            // Fallback for unexpected object structure
                            documentContent = '<p>Start writing your document here...</p>';
                        }
                    }
                }
                
                console.log('📄 Final document content to display:', documentContent);
                
                // If we still don't have valid HTML, use default content
                if (!documentContent || documentContent === '{}' || documentContent === 'null' || documentContent === 'undefined' || documentContent.trim() === '') {
                    documentContent = '<p>Start writing your document here...</p>';
                }
                
                console.log('📝 Setting editor content:', documentContent);
                setContent(documentContent);
                setOriginalContent(documentContent);
                setUndoStack([documentContent]);
                
                // Set document title with proper fallback
                const title = document.title && document.title.trim() !== '' 
                    ? document.title.trim() 
                    : 'Untitled Document';
                setDocumentTitle(title);
                setOriginalTitle(title);
                
                if (editorRef.current) {
                    editorRef.current.innerHTML = documentContent;
                }
            } else {
                // Use default content if loading fails
                if (editorRef.current) {
                    editorRef.current.innerHTML = content;
                    setUndoStack([content]);
                    setOriginalContent(content);
                }
            }
        } catch (error) {
            // Use default content if loading fails
            if (editorRef.current) {
                editorRef.current.innerHTML = content;
                setUndoStack([content]);
                setOriginalContent(content);
            }
        } finally {
            setIsLoading(false);
        }
    }, [documentId, content, mounted]);

    // Ensure editor content is synchronized after loading
    useEffect(() => {
        if (mounted && editorRef.current && content && content !== '<p>Start writing your document here...</p>') {
            // Only update if the content is different from the default
            if (editorRef.current.innerHTML !== content) {
                // Add a small delay to ensure the editor is fully initialized
                setTimeout(() => {
                    if (editorRef.current) {
                        editorRef.current.innerHTML = content;
                    }
                }, 100);
            }
        }
    }, [content, mounted]);

    // Sync content with parent component
    useEffect(() => {
        // Only call onContentChange if content is not empty, different from original, and we're not currently updating
        if (content && content !== originalContent && !isUpdatingContentRef.current) {
            onContentChange?.(content);
        }
    }, [content, onContentChange, originalContent]);

    // Check for unsaved changes (content and title)
    useEffect(() => {
        if (documentId !== 'new') {
            const hasContentChanges = originalContent !== content;
            const hasTitleChanges = documentTitle.trim() !== originalTitle.trim();
            const hasChanges = hasContentChanges || hasTitleChanges;
            setHasUnsavedChanges(hasChanges);
            
            // Clear justSaved state when user makes changes
            if (hasChanges && justSaved) {
                setJustSaved(false);
            }
        } else {
            setHasUnsavedChanges(false);
        }
    }, [content, originalContent, documentId, documentTitle, originalTitle, justSaved]);

    // Save document function
    const saveDocument = useCallback(async (contentToSave: string, showSuccessMessage = true) => {
        if (documentId === 'new') return; // Don't save for new documents
        
        try {
            setIsSaving(true);
            setSaveError(null);
            
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
            });

            if (response.ok) {
                const updatedDoc = await response.json();
                setOriginalContent(contentToSave);
                setOriginalTitle(documentTitle.trim());
                setHasUnsavedChanges(false);
                
                if (showSuccessMessage) {
                    // Show blue feedback for manual saves
                    setJustSaved(true);
                    setTimeout(() => {
                        setJustSaved(false);
                    }, 2000);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to save document (${response.status})`);
            }
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save document');
            
            // Clear error after 5 seconds
            setTimeout(() => {
                setSaveError(null);
            }, 5000);
        } finally {
            setIsSaving(false);
        }
    }, [documentId, documentTitle]);

    // Auto-save content periodically - only for user writings
    useEffect(() => {
        if (!mounted || documentId === 'new' || !hasUnsavedChanges || !isUserTyping) return;
        
        const autoSaveTimer = setTimeout(() => {
            if (hasUnsavedChanges && content !== originalContent && isUserTyping) {
                saveDocument(content, false);
            }
        }, 3000); // Auto-save every 3 seconds if there are unsaved changes and user is typing
        
        return () => clearTimeout(autoSaveTimer);
    }, [content, originalContent, hasUnsavedChanges, documentId, mounted, saveDocument, isUserTyping]);

    // Manual save function
    const handleManualSave = useCallback(async () => {
        if (documentId === 'new') return;
        
        const contentToSave = editorRef.current?.innerHTML || content;
        await saveDocument(contentToSave, true);
    }, [documentId, content, saveDocument]);

    // Save content to undo stack
    const saveToUndoStack = useCallback((newContent: string) => {
        setUndoStack(prev => [...prev, newContent].slice(-50));
        setRedoStack([]);
    }, []);

    // Undo functionality
    const undo = useCallback(() => {
        if (undoStack.length > 1) {
            const currentContent = undoStack[undoStack.length - 1];
            const previousContent = undoStack[undoStack.length - 2];
            
            setRedoStack(prev => [...prev, currentContent]);
            setUndoStack(prev => prev.slice(0, -1));
            
            if (editorRef.current) {
                setIsUndoRedo(true);
                editorRef.current.innerHTML = previousContent;
                setContent(previousContent);
                // Update format state after undo
                setTimeout(() => {
                    // updateFormatState(); // This would need to be passed in
                    setIsUndoRedo(false);
                }, 0);
            }
        }
    }, [undoStack]);

    // Redo functionality
    const redo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextContent = redoStack[redoStack.length - 1];
            
            setUndoStack(prev => [...prev, nextContent]);
            setRedoStack(prev => prev.slice(0, -1));
            
            if (editorRef.current) {
                setIsUndoRedo(true);
                editorRef.current.innerHTML = nextContent;
                setContent(nextContent);
                // Update format state after redo
                setTimeout(() => {
                    // updateFormatState(); // This would need to be passed in
                    setIsUndoRedo(false);
                }, 0);
            }
        }
    }, [redoStack]);

    // Handle content changes from the editor
    const handleContentChange = useCallback(() => {
        if (editorRef.current && !isUndoRedo && !isUpdatingContentRef.current) {
            const newContent = editorRef.current.innerHTML;
            
            // Only update if content actually changed to prevent infinite loops
            if (newContent !== content) {
                isUpdatingContentRef.current = true;
                setContent(newContent);
                // Save to undo stack when content changes (but not during undo/redo)
                saveToUndoStack(newContent);
                
                // Only detect user typing if agent is not typing
                if (!isAgentTyping) {
                    setIsUserTyping(true);
                }
                
                // Reset the flag after a brief delay to allow the update to complete
                setTimeout(() => {
                    isUpdatingContentRef.current = false;
                }, 10);
            }
        }
    }, [saveToUndoStack, isUndoRedo, isAgentTyping, content]);

    // Get word count
    const getWordCount = () => {
        const text = content.replace(/<[^>]*>/g, '');
        return text.split(/\s+/).filter(Boolean).length;
    };

    // Get character count
    const getCharCount = () => {
        return content.replace(/<[^>]*>/g, '').length;
    };

    return {
        // Content state
        content,
        setContent,
        originalContent,
        setOriginalContent,
        
        // Format state
        formatState,
        setFormatState,
        
        // Editor refs
        editorRef,
        isUpdatingContentRef,
        
        // Undo/Redo
        undoStack,
        redoStack,
        isUndoRedo,
        undo,
        redo,
        saveToUndoStack,
        
        // Document state
        documentTitle,
        setDocumentTitle,
        originalTitle,
        setOriginalTitle,
        
        // Save state
        isSaving,
        setIsSaving,
        saveError,
        setSaveError,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        justSaved,
        setJustSaved,
        isSavingTitle,
        setIsSavingTitle,
        saveDocument,
        handleManualSave,
        
        // UI state
        isLoading,
        setIsLoading,
        mounted,
        
        // Typing state
        isUserTyping,
        setIsUserTyping,
        isAgentTyping,
        setIsAgentTyping,
        
        // Functions
        loadDocumentContent,
        handleContentChange,
        getWordCount,
        getCharCount
    };
}
