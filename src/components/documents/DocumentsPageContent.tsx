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
        <main className="flex-1 overflow-y-auto px-8 py-6 bg-white">
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
