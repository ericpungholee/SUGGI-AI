import HomeHeader from "@/components/home/HomeHeader";
import Sidebar from "@/components/home/Sidebar";
import DocumentGrid from "@/components/home/DocumentGrid";
import FolderGrid from "@/components/home/FolderGrid";
import ClientOnly from "@/components/ui/ClientOnly";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home() {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
        redirect('/auth/login');
    }

    // Check if user has any content
    const [folders, documents] = await Promise.all([
        prisma.folder.count({
            where: {
                userId: session.user.id,
                isDeleted: false
            }
        }),
        prisma.document.count({
            where: {
                userId: session.user.id,
                isDeleted: false
            }
        })
    ]);

    const hasContent = folders > 0 || documents > 0;

    return (
        <div className="flex h-screen bg-stone-light">
            {/* SideBar */}
            <ClientOnly fallback={
                <aside className="w-64 bg-white border-r border-brown-light/20 flex flex-col">
                    <div className="h-16 border-b border-brown-light/20"></div>
                    <div className="p-4"></div>
                </aside>
            }>
                <Sidebar />
            </ClientOnly>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <ClientOnly fallback={
                    <header className="h-16 bg-white border-b border-brown-light/20"></header>
                }>
                    <HomeHeader />
                </ClientOnly>

                {/* Content */}
                <main className="flex-1 overflow-y-auto px-8 py-6">
                    {!hasContent ? (
                        // Welcome message for new users
                        <div className="text-center py-20">
                            <div className="w-24 h-24 mx-auto mb-6 bg-stone-light rounded-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-bold text-ink mb-4">Welcome to SSUGI!</h1>
                            <p className="text-lg text-ink/70 mb-8 max-w-md mx-auto">
                                Your AI-powered writing companion. Start creating your first document or organize your thoughts with folders.
                            </p>
                            <div className="flex gap-4 justify-center">
                                <a 
                                    href="/editor/new" 
                                    className="inline-flex items-center gap-2 bg-brown-medium text-white px-6 py-3 rounded-lg hover:bg-brown-dark transition-colors font-medium"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Document
                                </a>
                                <a 
                                    href="/folders" 
                                    className="inline-flex items-center gap-2 bg-white text-ink border border-brown-light/20 px-6 py-3 rounded-lg hover:bg-stone-light transition-colors font-medium"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                                    </svg>
                                    Create Folder
                                </a>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Folders */}
                            {folders > 0 && (
                                <section className="mb-8">
                                    <h2 className="text-lg font-medium text-ink/70 mb-4">Folders</h2>
                                    <ClientOnly fallback={
                                        <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className='bg-white border border-brown-light/20 rounded-xl p-4 animate-pulse'>
                                                    <div className='w-12 h-12 bg-gray-200 rounded-lg mb-3'></div>
                                                    <div className='h-4 bg-gray-200 rounded mb-2'></div>
                                                    <div className='h-3 bg-gray-200 rounded'></div>
                                                </div>
                                            ))}
                                        </div>
                                    }>
                                        <FolderGrid />
                                    </ClientOnly>
                                </section>
                            )}
                            
                            {/* Documents */}
                            {documents > 0 && (
                                <section className="mb-8">
                                    <ClientOnly fallback={
                                        <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className='bg-white border border-brown-light/20 rounded-xl p-5 animate-pulse'>
                                                    <div className='h-5 bg-gray-200 rounded mb-3'></div>
                                                    <div className='h-4 bg-gray-200 rounded mb-2'></div>
                                                    <div className='h-3 bg-gray-200 rounded'></div>
                                                </div>
                                            ))}
                                        </div>
                                    }>
                                        <DocumentGrid />
                                    </ClientOnly>
                                </section>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}