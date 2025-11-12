/**
 * Document Management Hook
 * Handles all document-related operations (save, load, delete, etc.)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const useDocumentManagement = (
    documentId: string,
    editorRef: React.RefObject<HTMLDivElement | null>,
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

    // Ref to prevent content update loops
    const isUpdatingContentRef = useRef(false)
    
    // Ref to track if user is actively typing
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isUserActivelyTypingRef = useRef(false)

    // Prevent hydration mismatch by only running on client
    useEffect(() => {
        setMounted(true)
    }, [])

    // Function to mark user as actively typing
    const markUserTyping = useCallback(() => {
        isUserActivelyTypingRef.current = true
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }
        
        // Set timeout to mark user as not typing and sync content after 500ms
        typingTimeoutRef.current = setTimeout(() => {
            isUserActivelyTypingRef.current = false
            
            // Update content state after user stops typing
            if (editorRef.current) {
                const currentContent = editorRef.current.innerHTML
                if (currentContent !== content) {
                    console.log('🔄 Syncing content state after typing stopped')
                    setContent(currentContent)
                }
            }
        }, 500)
    }, [content, editorRef])

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
        // This is intentional - empty documents should be saved as empty
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
                let documentContent = ''
                let hasContentFromDatabase = false
                let isIntentionallyEmpty = false
                
                if (document.content !== null && document.content !== undefined) {
                    console.log('🔍 Loading document content:', {
                        contentType: typeof document.content,
                        content: document.content,
                        hasHtml: document.content?.html ? 'yes' : 'no',
                        hasPlainText: document.content?.plainText ? 'yes' : 'no'
                    })
                    
                    if (typeof document.content === 'string') {
                        // Legacy string content - even if empty, it's from database
                        documentContent = document.content
                        hasContentFromDatabase = true
                        if (documentContent === '') {
                            isIntentionallyEmpty = true
                        }
                    } else if (typeof document.content === 'object' && document.content !== null) {
                        // Modern JSON content structure
                        if (document.content.html !== undefined && typeof document.content.html === 'string') {
                            documentContent = document.content.html
                            hasContentFromDatabase = true
                            if (documentContent === '') {
                                isIntentionallyEmpty = true
                            }
                        } else if (document.content.plainText !== undefined && typeof document.content.plainText === 'string') {
                            // If no HTML but we have plain text, wrap it in a paragraph
                            const trimmedPlainText = document.content.plainText.trim()
                            documentContent = trimmedPlainText ? `<p>${document.content.plainText}</p>` : ''
                            hasContentFromDatabase = true
                            if (documentContent === '') {
                                isIntentionallyEmpty = true
                            }
                        } else {
                            // Check if the object itself contains valid content (fallback)
                            const contentStr = JSON.stringify(document.content)
                            if (contentStr && contentStr !== '{}' && contentStr !== 'null' && contentStr !== 'undefined') {
                                // Try to extract any text content from the object
                                const textContent = extractTextFromObject(document.content)
                                if (textContent) {
                                    documentContent = `<p>${textContent}</p>`
                                    hasContentFromDatabase = true
                                }
                            }
                        }
                    }
                }
                
                console.log('📄 Final document content to display:', {
                    documentContent,
                    hasContentFromDatabase,
                    isIntentionallyEmpty,
                    contentLength: documentContent.length
                })
                
                // Only use default content if we have NO content field from the database at all
                if (!hasContentFromDatabase) {
                    console.log('⚠️ No content field from database - using default content')
                    documentContent = '<p>Start writing your document here...</p>'
                } else if (isIntentionallyEmpty) {
                    // User intentionally deleted all content - keep it empty
                    console.log('📝 User intentionally deleted all content - keeping empty')
                    documentContent = ''
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
        
        // Ensure editor content is synchronized when content state changes
        // But only if we're not currently updating or user is actively typing
        // AND there's no pending agent content
        if (editorRef.current && content !== editorRef.current.innerHTML && !isUpdatingContentRef.current && !isUserActivelyTypingRef.current) {
            // Check if there's pending agent content that should not be overwritten
            const hasPendingAgentContent = editorRef.current.querySelector('.agent-text-block[data-is-approved="false"]')
            
            if (!hasPendingAgentContent) {
                console.log('🔄 Syncing editor content with state')
                isUpdatingContentRef.current = true
                editorRef.current.innerHTML = content
                isUpdatingContentRef.current = false
            } else {
                console.log('⏸️ Skipping content sync - pending agent content detected')
            }
        }
    }, [content, onContentChange, originalContent])

    // Check for unsaved changes (content and title) - using periodic check to avoid cursor issues
    useEffect(() => {
        if (documentId === 'new') {
            setHasUnsavedChanges(false)
            return
        }

        const checkUnsavedChanges = () => {
            // Get current editor content directly from DOM instead of relying on content state
            const currentEditorContent = editorRef.current?.innerHTML || ''
            const hasContentChanges = originalContent !== currentEditorContent
            const hasTitleChanges = documentTitle.trim() !== originalTitle.trim()
            const hasChanges = hasContentChanges || hasTitleChanges
            
            console.log('🔍 Checking unsaved changes:', {
                originalContent: originalContent.substring(0, 50) + '...',
                currentEditorContent: currentEditorContent.substring(0, 50) + '...',
                originalLength: originalContent.length,
                currentLength: currentEditorContent.length,
                hasContentChanges,
                hasTitleChanges,
                hasChanges,
                documentId
            })
            
            setHasUnsavedChanges(hasChanges)
            
            // Clear justSaved state when user makes changes
            if (hasChanges && justSaved) {
                setJustSaved(false)
            }
        }

        // Check immediately
        checkUnsavedChanges()

        // Set up periodic check every 500ms to detect changes without interfering with typing
        const interval = setInterval(checkUnsavedChanges, 500)

        return () => clearInterval(interval)
    }, [originalContent, documentId, documentTitle, originalTitle, justSaved, editorRef])

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

    // Auto-save content periodically - only for user writings (not agent content)
    useEffect(() => {
        if (!mounted || documentId === 'new' || !hasUnsavedChanges || !isUserTyping) return
        
        const autoSaveTimer = setTimeout(() => {
            if (hasUnsavedChanges && isUserTyping) {
                // Always use current editor content for auto-save
                const rawContent = editorRef.current?.innerHTML || ''
                const currentContent = cleanEditorContent(rawContent)
                
                // Only save if content is actually different from what was last saved
                if (currentContent !== originalContent) {
                    console.log('💾 Auto-saving user content:', {
                        isUserTyping,
                        isAgentTyping,
                        contentLength: currentContent.length,
                        hasChanges: currentContent !== originalContent
                    })
                    saveDocument(currentContent, false)
                }
            }
        }, 3000) // Auto-save every 3 seconds if there are unsaved changes and user is typing
        
        return () => clearTimeout(autoSaveTimer)
    }, [hasUnsavedChanges, isUserTyping, documentId, mounted])

    // Manual save function
    const handleManualSave = useCallback(async () => {
        if (documentId === 'new') {
            console.log('⚠️ Cannot save new document')
            return
        }
        
        console.log('💾 Manual save triggered:', {
            documentId,
            hasEditorRef: !!editorRef.current,
            hasUnsavedChanges,
            currentContent: content.substring(0, 100) + '...'
        })
        
        // Get current editor content and clean it up
        const rawContent = editorRef.current?.innerHTML || ''
        const contentToSave = cleanEditorContent(rawContent)
        
        console.log('💾 Manual save - Raw content length:', rawContent.length, 'Cleaned content length:', contentToSave.length)
        console.log('💾 Manual save - Raw content:', rawContent.substring(0, 200))
        console.log('💾 Manual save - Cleaned content:', contentToSave.substring(0, 200))
        
        await saveDocument(contentToSave, true)
    }, [documentId, saveDocument, cleanEditorContent, editorRef, hasUnsavedChanges, content])

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
        cleanEditorContent,
        isUpdatingContentRef,
        markUserTyping
    }
}
