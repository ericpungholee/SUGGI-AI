'use client'
import DocumentGrid from "./DocumentGrid";
import FolderGrid from "./FolderGrid";
import SearchBar from "./SearchBar";
import SearchResults from "./SearchResults";
import { useSearch } from "./useSearch";

interface HomeContentProps {
    hasContent: boolean;
    folders: number;
    documents: number;
    gridDensity?: 'compact' | 'comfortable' | 'spacious';
}

export default function HomeContent({ hasContent, folders, documents, gridDensity = 'comfortable' }: HomeContentProps) {
    const { results, isLoading, query, hasSearched, search, clearSearch } = useSearch();

    if (!hasContent) {
        // Welcome message for new users
        return (
            <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-6 bg-white border border-black rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-serif font-bold text-ink mb-4">Welcome to Suggi!</h1>
                <p className="text-lg text-ink/70 mb-8 max-w-md mx-auto">
                    Your AI-powered writing companion. Start creating your first document or organize your thoughts with folders.
                </p>
                <div className="flex gap-4 justify-center">
                    <a 
                        href="/editor/new" 
                        className="inline-flex items-center justify-center p-3 border border-black rounded-lg hover:bg-gray-100 transition-colors"
                        title="Create Document"
                    >
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </a>
                    <a 
                        href="/folders" 
                        className="inline-flex items-center justify-center p-3 border border-black rounded-lg hover:bg-gray-100 transition-colors"
                        title="Create Folder"
                    >
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        </svg>
                    </a>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Search Bar */}
            <SearchBar onSearch={search} onClear={clearSearch} />

            {/* Search Results */}
            {hasSearched && (
                <SearchResults 
                    results={results}
                    query={query}
                    isLoading={isLoading}
                    onClose={clearSearch}
                />
            )}

            {/* Regular Content - only show when not searching or when search is cleared */}
            {!hasSearched && (
                <>
                    {/* Folders */}
                    {folders > 0 && (
                        <section className="mb-8 pb-8 border-b border-black">
                            <FolderGrid gridDensity={gridDensity} />
                        </section>
                    )}
                    
                    {/* Documents */}
                    {documents > 0 && (
                        <section className="mb-8">
                            <DocumentGrid gridDensity={gridDensity} />
                        </section>
                    )}
                </>
            )}
        </>
    );
}
