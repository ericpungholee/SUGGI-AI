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
                className="inline-flex items-center justify-center bg-white w-12 h-12 rounded-lg hover:bg-gray-100 transition-colors shadow-sm border border-gray-200"
                title="Create New Folder"
            >
                <Plus className="w-6 h-6 text-black" />
            </button>

            <CreateFolderModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onFolderCreated={handleFolderCreated}
            />
        </>
    )
}
