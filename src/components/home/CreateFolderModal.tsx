'use client'
import { useState } from 'react'
import { X, Folder, Check } from 'lucide-react'

interface CreateFolderModalProps {
    isOpen: boolean
    onClose: () => void
    onFolderCreated: () => void
    parentId?: string
}

const folderIcons = [
    { name: 'blue', icon: Folder, color: 'bg-blue-100', bgColor: 'bg-blue-100' },
    { name: 'green', icon: Folder, color: 'bg-green-100', bgColor: 'bg-green-100' },
    { name: 'purple', icon: Folder, color: 'bg-purple-100', bgColor: 'bg-purple-100' },
    { name: 'amber', icon: Folder, color: 'bg-amber-100', bgColor: 'bg-amber-100' },
    { name: 'pink', icon: Folder, color: 'bg-pink-100', bgColor: 'bg-pink-100' },
    { name: 'indigo', icon: Folder, color: 'bg-indigo-100', bgColor: 'bg-indigo-100' },
]

export default function CreateFolderModal({ isOpen, onClose, onFolderCreated, parentId }: CreateFolderModalProps) {
    const [folderName, setFolderName] = useState('')
    const [selectedIcon, setSelectedIcon] = useState('blue')
    const [isCreating, setIsCreating] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!folderName.trim()) return

        setIsCreating(true)
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: folderName.trim(),
                    icon: selectedIcon,
                    parentId: parentId || null
                })
            })

            if (response.ok) {
                setFolderName('')
                setSelectedIcon('blue')
                onFolderCreated()
                onClose()
            } else {
                const error = await response.json()
                console.error('Failed to create folder:', error)
            }
        } catch (error) {
            console.error('Error creating folder:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleClose = () => {
        if (!isCreating) {
            setFolderName('')
            setSelectedIcon('blue')
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-ink">
                        {parentId ? 'Create Subfolder' : 'Create New Folder'}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-stone-light rounded-lg transition-colors"
                        disabled={isCreating}
                    >
                        <X className="w-5 h-5 text-ink/60" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="folderName" className="block text-sm font-medium text-ink mb-2">
                            Folder Name
                        </label>
                        <input
                            type="text"
                            id="folderName"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            placeholder="Enter folder name"
                            className="w-full px-3 py-2 border border-brown-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-medium focus:border-transparent"
                            disabled={isCreating}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-ink mb-2">
                            Choose Icon
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {folderIcons.map((iconOption) => (
                                <button
                                    key={iconOption.name}
                                    type="button"
                                    onClick={() => setSelectedIcon(iconOption.name)}
                                    className={`p-3 rounded-lg border-2 transition-all ${
                                        selectedIcon === iconOption.name
                                            ? 'border-brown-medium bg-brown-light/10'
                                            : 'border-brown-light/20 hover:border-brown-light/40'
                                    }`}
                                    disabled={isCreating}
                                >
                                    <div className={`w-8 h-8 ${iconOption.bgColor} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                                        <iconOption.icon className="w-5 h-5 text-ink/60" />
                                    </div>
                                    {selectedIcon === iconOption.name && (
                                        <Check className="w-4 h-4 text-brown-medium mx-auto" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 bg-white border-2 border-black rounded-lg hover:bg-gray-100 transition-colors text-black font-semibold shadow-sm"
                            disabled={isCreating}
                            style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-white border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-black font-semibold shadow-sm"
                            style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Create Folder
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
