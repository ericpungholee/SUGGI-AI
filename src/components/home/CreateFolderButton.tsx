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
                className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors border-2 border-red-500"
                style={{ minWidth: '120px', minHeight: '40px', color: 'white' }}
            >
                <Plus className="w-4 h-4" style={{ color: 'white' }} />
                <span style={{ color: 'white' }}>New Folder</span>
            </button>

            <CreateFolderModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onFolderCreated={handleFolderCreated}
            />
        </>
    )
}
