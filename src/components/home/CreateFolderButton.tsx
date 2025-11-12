'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import CreateFolderModal from './CreateFolderModal'

export default function CreateFolderButton() {
    const [showCreateModal, setShowCreateModal] = useState(false)

    const handleCreateFolder = () => {
        setShowCreateModal(true)
    }

    const handleFolderCreated = () => {
        // Refresh the page to show the new folder
        window.location.reload()
    }

    return (
        <>
            <button 
                onClick={handleCreateFolder}
                className="p-2 text-black/40 hover:text-black transition-colors"
                title="Create New Folder"
            >
                <Plus className="w-5 h-5" />
            </button>

            <CreateFolderModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onFolderCreated={handleFolderCreated}
            />
        </>
    )
}
