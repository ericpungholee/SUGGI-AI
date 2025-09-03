import HomeHeader from "@/components/home/HomeHeader";
import Sidebar from "@/components/home/Sidebar";
import HomeContent from "@/components/home/HomeContent";
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
                    <HomeHeader title="Home" />
                </ClientOnly>

                {/* Content */}
                <main className="flex-1 overflow-y-auto px-8 py-6">
                    <ClientOnly fallback={
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
                        </div>
                    }>
                        <HomeContent 
                            hasContent={hasContent}
                            folders={folders}
                            documents={documents}
                        />
                    </ClientOnly>
                </main>
            </div>
        </div>
    )
}