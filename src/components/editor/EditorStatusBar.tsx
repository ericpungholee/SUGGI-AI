'use client'

interface EditorStatusBarProps {
    wordCount: number;
    charCount: number;
    isSaving: boolean;
    saveError: string | null;
    documentId: string;
}

export default function EditorStatusBar({
    wordCount,
    charCount,
    isSaving,
    saveError,
    documentId
}: EditorStatusBarProps) {
    return (
        <div className="h-8 border-t border-gray-200 bg-gray-50 px-4 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
                <span>{wordCount} words</span>
                <span>{charCount} characters</span>
                {isSaving && <span className="text-blue-600">Saving...</span>}
                {saveError && (
                    <span className="text-red-600">Save failed</span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                    Document ID: {documentId}
                </span>
            </div>
        </div>
    );
}
