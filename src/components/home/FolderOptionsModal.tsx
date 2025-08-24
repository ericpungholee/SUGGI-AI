'use client'
import { useState } from 'react'
import { X, Edit, Trash2, Folder } from 'lucide-react'

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

    if (!isOpen || !folder) return null

    const handleEdit = () => {
        setEditName(folder.name)
        setIsEditing(true)
    }

    const handleSave = async () => {
        if (!editName.trim() || editName === folder.name) {
            setIsEditing(false)
            return
        }

        setIsUpdating(true)
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
                onFolderUpdated()
                setIsEditing(false)
            } else {
                const error = await response.json()
                console.error('Failed to update folder:', error)
            }
        } catch (error) {
            console.error('Error updating folder:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${folder.name}"? This action cannot be undone.`)) {
            return
        }

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
                console.error('Failed to delete folder:', error)
            }
        } catch (error) {
            console.error('Error deleting folder:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleClose = () => {
        if (!isUpdating && !isDeleting) {
            setIsEditing(false)
            setEditName('')
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                            <p className="text-sm text-ink/60">{folder.count} items</p>
                        </div>
                    </div>

                    {/* Edit Name */}
                    {isEditing ? (
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
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 border border-brown-light/20 text-ink rounded-lg hover:bg-stone-light transition-colors"
                                    disabled={isUpdating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!editName.trim() || editName === folder.name || isUpdating}
                                    className="px-4 py-2 bg-brown-medium text-white rounded-lg hover:bg-brown-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUpdating ? 'Saving...' : 'Save'}
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
                            onClick={handleDelete}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={isUpdating || isDeleting}
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>{isDeleting ? 'Deleting...' : 'Delete folder'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
