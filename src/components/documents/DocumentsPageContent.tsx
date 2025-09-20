'use client'
import DocumentGrid from "@/components/home/DocumentGrid";
import DocumentSearchBar from "@/components/home/DocumentSearchBar";
import DocumentSearchResults from "@/components/home/DocumentSearchResults";
import { useDocumentSearch } from "@/hooks/useDocumentSearch";

export default function DocumentsPageContent() {
    const { results, isLoading, query, hasSearched, search, clearSearch } = useDocumentSearch();

    return (
        <main className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-ink mb-2">All Documents</h1>
                <p className="text-ink/60">View and manage all your documents</p>
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
                <DocumentGrid />
            )}
        </main>
    );
}
