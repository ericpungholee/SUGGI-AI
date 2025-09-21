'use client'
import FolderGrid from "@/components/home/FolderGrid";
import FolderSearchBar from "@/components/home/FolderSearchBar";
import FolderSearchResults from "@/components/home/FolderSearchResults";
import CreateFolderButton from "@/components/home/CreateFolderButton";
import { useFolderSearch } from "@/hooks/useFolderSearch";

interface FoldersPageContentProps {
    gridDensity?: 'compact' | 'comfortable' | 'spacious';
}

export default function FoldersPageContent({ gridDensity = 'comfortable' }: FoldersPageContentProps) {
    const { results, isLoading, query, hasSearched, search, clearSearch } = useFolderSearch();

    return (
        <main className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-ink mb-2">Folders</h1>
                    <p className="text-ink/60">Organize your documents into folders</p>
                </div>
                <CreateFolderButton />
            </div>
            
            {/* Search Bar */}
            <FolderSearchBar 
                onSearch={search}
                onClear={clearSearch}
                placeholder="Search folders..."
            />
            
            {/* Search Results or Folder Grid */}
            {hasSearched ? (
                <FolderSearchResults 
                    results={results}
                    isLoading={isLoading}
                    query={query}
                />
            ) : (
                <FolderGrid showCreateButton={false} gridDensity={gridDensity} />
            )}
        </main>
    );
}
