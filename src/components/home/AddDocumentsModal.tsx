'use client'
import { useState, useEffect } from 'react'
import { X, FileText, Plus, Search } from 'lucide-react'

interface Document {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
    folderId?: string
}

interface AddDocumentsModalProps {
    isOpen: boolean
    onClose: () => void
    folderId: string
    onDocumentsAdded: () => void
}

export default function AddDocumentsModal({ 
    isOpen, 
    onClose, 
    folderId,
    onDocumentsAdded 
}: AddDocumentsModalProps) {
    const [documents, setDocuments] = useState<Document[]>([])
    const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            fetchAvailableDocuments()
        }
    }, [isOpen])

    const fetchAvailableDocuments = async () => {
        try {
            setLoading(true)
            // Fetch documents that are not in any folder or in a different folder
            const response = await fetch('/api/documents')
            if (response.ok) {
                const data = await response.json()
                // Filter out documents already in this folder
                const availableDocs = data.filter((doc: Document) => doc.folderId !== folderId)
                setDocuments(availableDocs)
            } else {
                setError('Failed to fetch documents')
            }
        } catch (error) {
            setError('Network error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleDocumentSelect = (documentId: string) => {
        const newSelected = new Set(selectedDocuments)
        if (newSelected.has(documentId)) {
            newSelected.delete(documentId)
        } else {
            newSelected.add(documentId)
        }
        setSelectedDocuments(newSelected)
    }

    const handleAddToFolder = async () => {
        if (selectedDocuments.size === 0) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/documents', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentIds: Array.from(selectedDocuments),
                    folderId: folderId,
                    action: 'add'
                })
            })

            if (response.ok) {
                onDocumentsAdded()
                onClose()
            } else {
                const errorData = await response.json()
                setError(errorData.error || 'Failed to add documents to folder')
            }
        } catch (error) {
            setError('Network error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading) {
            setSelectedDocuments(new Set())
            setSearchTerm('')
            setError(null)
            onClose()
        }
    }

    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.preview.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-ink">Add Documents to Folder</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-stone-light rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink/40" />
                            <input
                                type="text"
                                placeholder="Search documents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-brown-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-medium focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Document List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                                ))}
                            </div>
                        ) : filteredDocuments.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto mb-3 bg-stone-light rounded-full flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-ink/40" />
                                </div>
                                <p className="text-ink/50">
                                    {searchTerm ? 'No documents match your search' : 'No available documents to add'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredDocuments.map((doc) => (
                                    <label
                                        key={doc.id}
                                        className="flex items-center gap-3 p-3 border border-brown-light/20 rounded-lg hover:bg-stone-light cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedDocuments.has(doc.id)}
                                            onChange={() => handleDocumentSelect(doc.id)}
                                            className="text-brown-medium rounded"
                                        />
                                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <FileText className="w-4 h-4 text-ink/60" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-ink text-sm mb-1 truncate">{doc.title}</h4>
                                            <p className="text-xs text-ink/40 line-clamp-2">{doc.preview}</p>
                                        </div>
                                        <div className="text-xs text-ink/40 text-right">
                                            <div>{doc.wordCount} words</div>
                                            <div>{doc.lastModified}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                                                              {/* Actions */}
                     <div className="flex gap-3 pt-4 border-t border-gray-200">
                         <button
                             onClick={handleClose}
                             className="flex-1 px-4 py-2 bg-white border-2 border-black rounded-lg hover:bg-gray-100 transition-colors text-black font-semibold shadow-sm"
                             disabled={loading}
                             style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}
                         >
                             Cancel
                         </button>
                         <button
                             onClick={handleAddToFolder}
                             disabled={selectedDocuments.size === 0 || loading}
                             className="flex-1 px-4 py-2 bg-white border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-black font-semibold shadow-sm"
                             style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}
                         >
                             {loading ? (
                                 <>
                                     <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                     Adding...
                                 </>
                             ) : (
                                 <>
                                     <Plus className="w-4 h-4" />
                                     Add {selectedDocuments.size > 0 ? `(${selectedDocuments.size})` : ''} to Folder
                                 </>
                             )}
                         </button>
                     </div>
                </div>
            </div>
        </div>
    )
}
