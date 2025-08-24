'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Star, Clock, MoreVertical, X } from 'lucide-react'
import AddDocumentsModal from './AddDocumentsModal'

interface Document {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
    folderId?: string
}

interface FolderContentProps {
    folderId: string
}

export default function FolderContent({ folderId }: FolderContentProps) {
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const router = useRouter()

    useEffect(() => {
        fetchFolderContent()
    }, [folderId])

    const fetchFolderContent = async () => {
        try {
            setLoading(true)
            
            // Fetch documents in this folder
            const docsResponse = await fetch(`/api/documents?folderId=${folderId}`)
            if (docsResponse.ok) {
                const docsData = await docsResponse.json()
                setDocuments(docsData)
            }
        } catch (error) {
            console.error('Error fetching folder content:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDocumentClick = (documentId: string) => {
        router.push(`/editor/${documentId}`)
    }

    const handleAddExistingDocument = () => {
        setShowAddModal(true)
    }

    const handleDocumentsAdded = () => {
        fetchFolderContent()
    }

    const handleRemoveDocument = async (documentId: string) => {
        try {
            const response = await fetch('/api/documents', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentIds: [documentId],
                    action: 'remove'
                })
            })

            if (response.ok) {
                // Remove the document from the local state
                setDocuments(prev => prev.filter(doc => doc.id !== documentId))
            } else {
                console.error('Failed to remove document from folder')
            }
        } catch (error) {
            console.error('Error removing document from folder:', error)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium text-ink">Contents</h2>
                    <div className="w-32 h-9 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-white border border-brown-light/20 rounded-xl p-5 animate-pulse">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg mb-3"></div>
                            <div className="h-4 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header with actions */}
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-medium text-ink">
                        Contents ({documents.length} documents)
                    </h2>
                                         <button
                         onClick={handleAddExistingDocument}
                         className="inline-flex items-center justify-center bg-white w-12 h-12 rounded-lg hover:bg-gray-100 transition-colors shadow-sm border border-gray-200"
                         title="Add Document"
                     >
                         <Plus className="w-6 h-6 text-black" />
                     </button>
                </div>

                {/* Documents */}
                {documents.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="group relative bg-white border border-brown-light/20 rounded-xl p-5 hover:shadow-md transition-all hover:-translate-y-0.5"
                            >
                                {/* 3-dot menu */}
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                // For now, just remove the document directly
                                                // In the future, this could open a dropdown menu
                                                handleRemoveDocument(doc.id)
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                                            title="Remove from folder"
                                        >
                                            <X className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </div>
                                </div>

                                {/* Document content - clickable */}
                                <div 
                                    className="cursor-pointer"
                                    onClick={() => handleDocumentClick(doc.id)}
                                >
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                                        <FileText className="w-6 h-6 text-ink/60" />
                                    </div>
                                    <h4 className="font-medium text-ink mb-2 line-clamp-1 hover:text-brown-medium transition-colors">{doc.title}</h4>
                                    <p className="text-sm text-ink/60 mb-3 line-clamp-2">{doc.preview}</p>
                                    <div className="flex items-center justify-between text-xs text-ink/40">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{doc.lastModified}</span>
                                        </div>
                                        <span>{doc.wordCount} words</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-ink/40" />
                        </div>
                        <h3 className="text-lg font-medium text-ink/70 mb-2">This folder is empty</h3>
                        <p className="text-ink/50 mb-6">Add existing documents to get started</p>
                                                 <button
                             onClick={handleAddExistingDocument}
                             className="inline-flex items-center justify-center bg-white w-16 h-16 rounded-lg hover:bg-gray-100 transition-colors shadow-md border border-gray-200"
                             title="Add Document"
                         >
                             <Plus className="w-8 h-8 text-black" />
                         </button>
                    </div>
                )}
            </div>

            {/* Add Documents Modal */}
            <AddDocumentsModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                folderId={folderId}
                onDocumentsAdded={handleDocumentsAdded}
            />
        </>
    )
}
