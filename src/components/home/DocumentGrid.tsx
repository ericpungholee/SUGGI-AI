'use client'
import { FileText, MoreVertical, Star, Clock, Plus, RefreshCw, Trash2, Edit3 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface Document {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
}

export default function DocumentGrid() {
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [starredDocs, setStarredDocs] = useState<Set<string>>(new Set())
    const [showMoreOptions, setShowMoreOptions] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { data: session } = useSession()
    const router = useRouter()

    // Prevent hydration mismatch by only running on client
    useEffect(() => {
        setMounted(true)
    }, [])

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/documents')
            if (response.ok) {
                const data = await response.json()
                setDocuments(data)
                // Initialize starred state from fetched data
                const starredIds = new Set(data.filter((doc: Document) => doc.starred).map((doc: Document) => doc.id))
                setStarredDocs(starredIds)
            } else {
                console.error('Failed to fetch documents')
                setDocuments([])
            }
        } catch (error) {
            console.error('Error fetching documents:', error)
            setDocuments([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDocuments()
    }, [fetchDocuments])

    const toggleStar = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        const isCurrentlyStarred = starredDocs.has(docId)
        
        // Optimistically update UI
        setStarredDocs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(docId)) {
                newSet.delete(docId)
            } else {
                newSet.add(docId)
            }
            return newSet
        })

        // Update star status in database via API
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    isStarred: !isCurrentlyStarred
                })
            })

            if (!response.ok) {
                // Revert optimistic update on error
                setStarredDocs(prev => {
                    const newSet = new Set(prev)
                    if (isCurrentlyStarred) {
                        newSet.add(docId)
                    } else {
                        newSet.delete(docId)
                    }
                    return newSet
                })
                console.error('Failed to update star status')
            }
        } catch (error) {
            // Revert optimistic update on error
            setStarredDocs(prev => {
                const newSet = new Set(prev)
                if (isCurrentlyStarred) {
                    newSet.add(docId)
                } else {
                    newSet.delete(docId)
                }
                return newSet
            })
            console.error('Error updating star status:', error)
        }
    }

    const handleDeleteDocument = async (docId: string) => {
        try {
            setIsDeleting(true)
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            if (response.ok) {
                // Remove document from local state
                setDocuments(prev => prev.filter(doc => doc.id !== docId))
                setShowDeleteConfirm(null)
            } else {
                const errorData = await response.json()
                console.error('Failed to delete document:', errorData.error)
                // You could show an error toast here
            }
        } catch (error) {
            console.error('Error deleting document:', error)
            // You could show an error toast here
        } finally {
            setIsDeleting(false)
        }
    }

    const handleMoreOptions = (e: React.MouseEvent, docId: string) => {
        e.preventDefault()
        e.stopPropagation()
        // Toggle the more options menu for this specific document
        setShowMoreOptions(showMoreOptions === docId ? null : docId)
    }

    const handleCreateDocument = () => {
        // Navigate to new document page
        router.push('/editor/new')
    }

    const handleRefresh = () => {
        fetchDocuments()
    }

    // Close more options menu when clicking outside
    useEffect(() => {
        if (!mounted) return
        
        const handleClickOutside = (event: MouseEvent) => {
            if (showMoreOptions && !(event.target as Element).closest('.more-options-container')) {
                setShowMoreOptions(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMoreOptions, mounted])

    // Don't render until mounted to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className='bg-white border border-brown-light/20 rounded-xl p-5 animate-pulse'>
                        <div className='h-5 bg-gray-200 rounded mb-3'></div>
                        <div className='h-4 bg-gray-200 rounded mb-2'></div>
                        <div className='h-3 bg-gray-200 rounded'></div>
                    </div>
                ))}
            </div>
        )
    }

    if (loading) {
        return (
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className='bg-white border border-brown-light/20 rounded-xl p-5 animate-pulse'>
                        <div className='h-5 bg-gray-200 rounded mb-3'></div>
                        <div className='h-4 bg-gray-200 rounded mb-2'></div>
                        <div className='h-3 bg-gray-200 rounded'></div>
                    </div>
                ))}
            </div>
        )
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-ink/40" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No documents yet</h3>
                <p className="text-ink/50 mb-6">Create your first document to get started</p>
                <button 
                    onClick={handleCreateDocument}
                    className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors"
                    style={{ color: 'white' }}
                >
                    <Plus className="w-4 h-4" style={{ color: 'white' }} />
                    <span style={{ color: 'white' }}>Create Document</span>
                </button>
            </div>
        )
    }

    return (
        <div>
            {/* Header with refresh button */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-ink/70">Documents</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 hover:bg-stone-light rounded-lg transition-colors"
                        title="Refresh documents"
                    >
                        <RefreshCw className="w-4 h-4 text-ink/60" />
                    </button>
                    <button
                        onClick={handleCreateDocument}
                        className="inline-flex items-center gap-2 bg-brown-medium text-white px-3 py-2 rounded-lg hover:bg-brown-dark transition-colors text-sm"
                        style={{ color: 'white' }}
                    >
                        <Plus className="w-4 h-4" style={{ color: 'white' }} />
                        <span style={{ color: 'white' }}>New Document</span>
                    </button>
                </div>
            </div>
            
            {/* Documents grid */}
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {documents.map((doc) => (
                    <div key={doc.id} className='group relative bg-white border border-brown-light/20 rounded-xl p-5 hover:shadow-md transition-all hover:-translate-0.5'>
                        <div className='flex items-start justify-between mb-3'>
                            <FileText className='w-5 h-5 text-brown-medium' />
                            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <button
                                    onClick={(e) => toggleStar(doc.id, e)}
                                    className="p-1 hover:bg-stone-light rounded transition-colors"
                                    type="button"
                                >
                                    <Star className={`w-4 h-4 ${starredDocs.has(doc.id) ? 'fill-amber-400 text-amber-400' : 'text-ink/40'}`} />
                                </button>
                                <button
                                    onClick={(e) => handleMoreOptions(e, doc.id)}
                                    className="p-1 hover:bg-stone-light rounded transition-colors"
                                    type="button"
                                >
                                    <MoreVertical className='w-4 h-4 text-ink/40' />
                                </button>
                            </div>
                        </div>
                        
                        {/* More Options Menu */}
                        {showMoreOptions === doc.id && (
                            <div className="more-options-container absolute top-12 right-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
                                <div className="py-1">
                                    <Link
                                        href={`/editor/${doc.id}`}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        Edit
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setShowMoreOptions(null) // Close the menu
                                            setShowDeleteConfirm(doc.id) // Show delete confirmation
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <Link href={`/editor/${doc.id}`} className="block">
                            <h3 className="font-medium text-ink mb-2 line-clamp-1 hover:text-brown-medium transition-colors">{doc.title}</h3>
                            <p className="text-sm text-ink/60 mb-3 line-clamp-2">{doc.preview}</p>
                            <div className="flex items-center justify-between text-xs text-ink/40">
                                <div className="flex items-center gap-1">
                                    <Clock className='w-3 h-3' />
                                    <span>{doc.lastModified}</span>
                                </div>
                                <span>{doc.wordCount} words</span>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl border border-gray-200 transform transition-all duration-200 scale-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Delete Document</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this document? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteDocument(showDeleteConfirm)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete Document
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}