'use client'
import { useState, useEffect } from 'react'
import { X, Edit, Trash2, Folder, Check, AlertCircle } from 'lucide-react'

interface FolderOptionsModalProps {
    isOpen: boolean
    onClose: () => void
    folder: {
        id: string
        name: string
        icon?: string
        count: number
    } | null
    onFolderUpdated: () => void
}

export default function FolderOptionsModal({ isOpen, onClose, folder, onFolderUpdated }: FolderOptionsModalProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Reset state when modal opens/closes or folder changes
    useEffect(() => {
        if (isOpen && folder) {
            console.log('Modal opening - resetting state for folder:', folder)
            // Force reset all state when modal opens - always start in view mode
            setIsEditing(false)
            setEditName('')
            setError(null)
            setSuccessMessage(null)
            setShowDeleteConfirm(false)
            setIsUpdating(false)
            setIsDeleting(false)
        }
    }, [isOpen, folder?.id])

    if (!isOpen || !folder) return null

    // Debug: Log the current state
    console.log('Modal render state:', { 
        isEditing, 
        editName, 
        isOpen, 
        folderName: folder.name,
        folderCount: folder.count
    })

    // Simple check - if editing, show form; if not, show button
    const shouldShowEditForm = isEditing
    const shouldShowEditButton = !isEditing
    
    console.log('Render logic:', { shouldShowEditForm, shouldShowEditButton, isEditing, editName })

    const handleEdit = () => {
        console.log('Edit button clicked, setting edit mode for folder:', folder.name)
        setEditName(folder.name)
        setIsEditing(true)
        setError(null)
        setSuccessMessage(null)
    }

    const handleSave = async () => {
        if (!editName.trim() || editName === folder.name) {
            setIsEditing(false)
            return
        }

        // Additional validation
        if (editName.trim().length < 1) {
            setError('Folder name cannot be empty')
            return
        }

        if (editName.trim().length > 100) {
            setError('Folder name is too long (max 100 characters)')
            return
        }
        
        setIsUpdating(true)
        setError(null)
        setSuccessMessage(null)
        
        try {
            const response = await fetch(`/api/folders/${folder.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: editName.trim()
                })
            })

            if (response.ok) {
                setSuccessMessage('Folder renamed successfully!')
                
                // Call the update callback first
                onFolderUpdated()
                
                // Reset the editing state
                setIsEditing(false)
                setEditName('')
                
                // Close the modal after a brief delay to show success message
                setTimeout(() => {
                    onClose()
                }, 1500)
            } else {
                const errorData = await response.json()
                const errorMessage = errorData.error || 'Failed to rename folder'
                setError(errorMessage)
            }
        } catch (error) {
            const errorMessage = 'Network error occurred. Please try again.'
            setError(errorMessage)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const response = await fetch(`/api/folders/${folder.id}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                onFolderUpdated()
                onClose()
            } else {
                const error = await response.json()
                // Handle error silently or show user feedback
            }
        } catch (error) {
            // Handle network error silently or show user feedback
        } finally {
            setIsDeleting(false)
        }
    }

    const handleClose = () => {
        if (!isUpdating && !isDeleting) {
            setIsEditing(false)
            setEditName('')
            setShowDeleteConfirm(false)
            setError(null)
            setSuccessMessage(null)
            onClose()
        }
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditName('')
        setError(null)
        setSuccessMessage(null)
    }

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-ink">Folder Options</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-stone-light rounded-lg transition-colors"
                        disabled={isUpdating || isDeleting}
                    >
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Folder Info */}
                    <div className="flex items-center gap-4 p-4 bg-stone-light rounded-lg">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Folder className="w-6 h-6 text-ink/60" />
                        </div>
                        <div>
                            <h3 className="font-medium text-ink">{folder.name}</h3>
                            <p className="text-sm text-ink/60">
                                {typeof folder.count === 'number' && !isNaN(folder.count) ? folder.count : 0} items
                            </p>
                        </div>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <Check className="w-5 h-5 text-green-600" />
                            <span className="text-green-800 text-sm">{successMessage}</span>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <span className="text-red-800 text-sm">{error}</span>
                        </div>
                    )}

                    {/* Edit Name */}
                    {shouldShowEditForm ? (
                        <div className="space-y-3">
                            <label htmlFor="editName" className="block text-sm font-medium text-ink">
                                Folder Name
                            </label>
                            <input
                                type="text"
                                id="editName"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 border border-brown-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-medium focus:border-transparent"
                                disabled={isUpdating}
                                autoFocus
                                placeholder="Enter folder name"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 border border-brown-light/20 text-ink rounded-lg hover:bg-stone-light transition-colors"
                                    disabled={isUpdating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!editName.trim() || editName === folder.name || isUpdating}
                                    className="px-4 py-2 bg-white text-black border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isUpdating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Save
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button
                                onClick={handleEdit}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-light rounded-lg transition-colors"
                                disabled={isUpdating || isDeleting}
                            >
                                <Edit className="w-5 h-5 text-ink/60" />
                                <span>Edit folder name</span>
                            </button>
                        </div>
                    )}

                    {/* Delete Button */}
                    <div className="pt-4 border-t border-brown-light/20">
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={isUpdating || isDeleting}
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>Delete folder</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl border border-gray-200 transform transition-all duration-200 scale-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Delete Folder</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete "{folder.name}"? This action cannot be undone and will also delete all documents and subfolders inside.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    handleDelete()
                                }}
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
                                        Delete Folder
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

