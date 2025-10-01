/**
 * Document Management Hook
 * Handles all document-related operations (save, load, delete, etc.)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const useDocumentManagement = (
    documentId: string,
    editorRef: React.RefObject<HTMLDivElement>,
    onContentChange?: (content: string) => void
) => {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [originalContent, setOriginalContent] = useState('')
    const [documentTitle, setDocumentTitle] = useState('Untitled Document')
    const [originalTitle, setOriginalTitle] = useState('Untitled Document')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isSavingTitle, setIsSavingTitle] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [justSaved, setJustSaved] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [mounted, setMounted] = useState(false)
    
    // User typing state
    const [isUserTyping, setIsUserTyping] = useState(false)
    
    // Agent typing state - prevents auto-save during agent typing
    const [isAgentTyping, setIsAgentTyping] = useState(false)

    // Prevent hydration mismatch by only running on client
    useEffect(() => {
        setMounted(true)
    }, [])

    // Helper function to extract text content from any object structure
    const extractTextFromObject = (obj: any): string | null => {
        if (typeof obj === 'string') {
            return obj.trim() || null
        }
        if (typeof obj === 'number' || typeof obj === 'boolean') {
            return String(obj)
        }
        if (Array.isArray(obj)) {
            return obj.map(extractTextFromObject).filter(Boolean).join(' ')
        }
        if (obj && typeof obj === 'object') {
            const textValues = Object.values(obj)
                .map(extractTextFromObject)
                .filter(Boolean)
            return textValues.length > 0 ? textValues.join(' ') : null
        }
        return null
    }

    // Helper function to clean up empty content
    const cleanEditorContent = useCallback((rawContent: string): string => {
        // Clean up empty content - if it's just empty paragraphs or whitespace, make it truly empty
        const cleanContent = rawContent
            .replace(/<p><br><\/p>/gi, '') // Remove empty paragraphs with line breaks
            .replace(/<p><\/p>/gi, '') // Remove completely empty paragraphs
            .replace(/<p>\s*<\/p>/gi, '') // Remove paragraphs with only whitespace
            .trim()
        
        // If after cleaning it's empty or just whitespace, return empty string
        if (!cleanContent || cleanContent === '' || cleanContent.replace(/<[^>]*>/g, '').trim() === '') {
            return ''
        }
        
        return cleanContent
    }, [])

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
                        // Legacy string content - validate it's not empty or just whitespace
                        const trimmedContent = document.content.trim()
                        if (trimmedContent && trimmedContent !== '{}' && trimmedContent !== 'null' && trimmedContent !== 'undefined') {
                            documentContent = document.content
                        }
                    } else if (typeof document.content === 'object' && document.content !== null) {
                        // Modern JSON content structure
                        if (document.content.html && typeof document.content.html === 'string') {
                            const trimmedHtml = document.content.html.trim()
                            if (trimmedHtml && trimmedHtml !== '{}' && trimmedHtml !== 'null' && trimmedHtml !== 'undefined') {
                                documentContent = document.content.html
                            }
                        } else if (document.content.plainText && typeof document.content.plainText === 'string') {
                            // If no HTML but we have plain text, wrap it in a paragraph
                            const trimmedPlainText = document.content.plainText.trim()
                            if (trimmedPlainText) {
                                documentContent = `<p>${document.content.plainText}</p>`
                            }
                        } else {
                            // Check if the object itself contains valid content (fallback)
                            const contentStr = JSON.stringify(document.content)
                            if (contentStr && contentStr !== '{}' && contentStr !== 'null' && contentStr !== 'undefined') {
                                // Try to extract any text content from the object
                                const textContent = extractTextFromObject(document.content)
                                if (textContent) {
                                    documentContent = `<p>${textContent}</p>`
                                }
                            }
                        }
                    }
                }
                
                console.log('📄 Final document content to display:', documentContent)
                
                // If we still don't have valid HTML, use default content
                if (!documentContent || 
                    documentContent === '{}' || 
                    documentContent === 'null' || 
                    documentContent === 'undefined' || 
                    documentContent.trim() === '' ||
                    documentContent === '[]' ||
                    documentContent === '""' ||
                    documentContent === "''") {
                    console.log('⚠️ Using default content - no valid content found')
                    documentContent = '<p>Start writing your document here...</p>'
                }
                
                console.log('📝 Setting editor content:', documentContent)
                setContent(documentContent)
                setOriginalContent(documentContent)
                
                // Set document title with proper fallback
                const title = document.title && document.title.trim() !== '' 
                    ? document.title.trim() 
                    : 'Untitled Document'
                setDocumentTitle(title)
                setOriginalTitle(title)
                
                // Update the editor content
                if (editorRef.current) {
                    editorRef.current.innerHTML = documentContent
                }
                
                // Force a re-render by updating the content state
                setContent(documentContent)
            } else {
                console.error('❌ Failed to load document:', {
                    documentId,
                    status: response.status,
                    statusText: response.statusText
                })
                
                // Try to get error details from response
                let errorMessage = `Failed to load document (${response.status})`
                try {
                    const errorData = await response.json()
                    if (errorData.error) {
                        errorMessage = errorData.error
                    }
                } catch (e) {
                    // Ignore JSON parsing errors for error response
                }
                
                // Use default content if loading fails
                const defaultContent = '<p>Start writing your document here...</p>'
                setContent(defaultContent)
                setOriginalContent(defaultContent)
                if (editorRef.current) {
                    editorRef.current.innerHTML = defaultContent
                }
                
                // Set error state
                setSaveError(errorMessage)
            }
        } catch (error) {
            console.error('❌ Error loading document content:', {
                documentId,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            })
            
            // Use default content if loading fails
            const defaultContent = '<p>Start writing your document here...</p>'
            setContent(defaultContent)
            setOriginalContent(defaultContent)
            if (editorRef.current) {
                editorRef.current.innerHTML = defaultContent
            }
            
            // Set a user-friendly error state
            setSaveError(`Failed to load document content: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsLoading(false)
        }
    }, [documentId, mounted])

    // Track if document has been loaded to prevent infinite loops
    const documentLoadedRef = useRef(false)
    
    // Initialize editor content
    useEffect(() => {
        if (!mounted || documentLoadedRef.current) return
        
        console.log('Initializing editor with documentId:', documentId)
        
        if (documentId === 'new') {
            // For new documents, set default content
            console.log('Setting up new document')
            const defaultContent = '<p>Start writing your document here...</p>'
            setContent(defaultContent)
            setOriginalContent(defaultContent)
            setDocumentTitle('Untitled Document')
            setOriginalTitle('Untitled Document')
            if (editorRef.current) {
                editorRef.current.innerHTML = defaultContent
            }
            documentLoadedRef.current = true
        } else {
            // Load existing document content
            loadDocumentContent()
            documentLoadedRef.current = true
        }
    }, [documentId, mounted])
    
    // Reset document loaded flag when documentId changes
    useEffect(() => {
        documentLoadedRef.current = false
    }, [documentId])

    // Sync content with parent component
    useEffect(() => {
        console.log('🔄 Content state changed:', {
            contentLength: content.length,
            originalContentLength: originalContent.length,
            shouldNotifyParent: content && content !== originalContent
        })
        
        // Only call onContentChange if content is not empty, different from original
        if (content && content !== originalContent) {
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
                    }
                })
            })

            if (response.ok) {
                const updatedDoc = await response.json()
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
            if (hasUnsavedChanges && isUserTyping) {
                // Always use current editor content for auto-save
                const rawContent = editorRef.current?.innerHTML || ''
                const currentContent = cleanEditorContent(rawContent)
                
                // Only save if content is actually different from what was last saved
                if (currentContent !== originalContent) {
                    saveDocument(currentContent, false)
                }
            }
        }, 3000) // Auto-save every 3 seconds if there are unsaved changes and user is typing
        
        return () => clearTimeout(autoSaveTimer)
    }, [hasUnsavedChanges, isUserTyping, documentId, mounted])

    // Manual save function
    const handleManualSave = useCallback(async () => {
        if (documentId === 'new') return
        
        // Get current editor content and clean it up
        const rawContent = editorRef.current?.innerHTML || ''
        const contentToSave = cleanEditorContent(rawContent)
        
        console.log('💾 Manual save - Original:', editorRef.current?.innerHTML, 'Cleaned:', contentToSave)
        await saveDocument(contentToSave, true)
    }, [documentId, saveDocument, cleanEditorContent, editorRef])

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

    // Handle navigation directly without warnings
    const handleNavigation = useCallback((url: string) => {
        router.push(url)
    }, [router])

    return {
        // State
        content,
        setContent,
        originalContent,
        documentTitle,
        setDocumentTitle,
        originalTitle,
        isLoading,
        isSaving,
        isSavingTitle,
        setIsSavingTitle,
        saveError,
        hasUnsavedChanges,
        justSaved,
        isDeleting,
        showDeleteConfirm,
        setShowDeleteConfirm,
        mounted,
        isUserTyping,
        setIsUserTyping,
        isAgentTyping,
        setIsAgentTyping,
        
        // Functions
        loadDocumentContent,
        saveDocument,
        handleManualSave,
        handleDeleteDocument,
        handleNavigation,
        cleanEditorContent
    }
}
