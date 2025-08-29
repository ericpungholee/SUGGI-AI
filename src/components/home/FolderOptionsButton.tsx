'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import FolderOptionsModal from './FolderOptionsModal';

interface FolderOptionsButtonProps {
    folder: {
        id: string;
        name: string;
        icon?: string;
        count: number;
    };
}

export default function FolderOptionsButton({ folder }: FolderOptionsButtonProps) {
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const router = useRouter();

    const handleFolderUpdated = () => {
        // If the folder was deleted, redirect to the appropriate page
        // For now, just refresh to show updated folder name
        // In the future, we could check if the folder still exists
        window.location.reload();
    };

    const handleFolderDeleted = () => {
        // Redirect to parent folder or main folders page
        // This will be handled by the modal's onClose
        setShowOptionsModal(false);
        // The modal will handle the redirect
    };

    return (
        <>
            <button
                onClick={() => setShowOptionsModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors"
                title="Folder options"
            >
                <MoreVertical className="w-4 h-4 text-ink/60" />
                <span className="text-ink">Options</span>
            </button>

            <FolderOptionsModal
                isOpen={showOptionsModal}
                onClose={() => setShowOptionsModal(false)}
                folder={folder}
                onFolderUpdated={handleFolderUpdated}
            />
        </>
    );
}
