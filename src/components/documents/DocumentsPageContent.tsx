'use client'
import DocumentGrid from "@/components/home/DocumentGrid";
import DocumentSearchBar from "@/components/home/DocumentSearchBar";
import DocumentSearchResults from "@/components/home/DocumentSearchResults";
import { useDocumentSearch } from "@/hooks/useDocumentSearch";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface DocumentsPageContentProps {
    gridDensity?: 'compact' | 'comfortable' | 'spacious';
}

export default function DocumentsPageContent({ gridDensity = 'comfortable' }: DocumentsPageContentProps) {
    const { results, isLoading, query, hasSearched, search, clearSearch } = useDocumentSearch();
    const router = useRouter();

    const handleCreateDocument = () => {
        router.push('/editor/new');
    };

    return (
        <main className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-ink mb-2">All Documents</h1>
                    <p className="text-ink/60">View and manage all your documents</p>
                </div>
                <button
                    onClick={handleCreateDocument}
                    className="inline-flex items-center justify-center bg-white w-12 h-12 rounded-lg hover:bg-gray-100 transition-colors shadow-sm border border-gray-200"
                    title="Create New Document"
                >
                    <Plus className="w-6 h-6 text-black" />
                </button>
            </div>
            
            {/* Search Bar */}
            <DocumentSearchBar 
                onSearch={search}
                onClear={clearSearch}
                placeholder="Search documents..."
            />
            
            {/* Search Results or Document Grid */}
            {hasSearched ? (
                <DocumentSearchResults 
                    results={results}
                    isLoading={isLoading}
                    query={query}
                />
            ) : (
                <DocumentGrid gridDensity={gridDensity} />
            )}
        </main>
    );
}
