import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientOnly from "@/components/ui/ClientOnly";
import Sidebar from "@/components/home/Sidebar";
import HomeHeader from "@/components/home/HomeHeader";
import FolderContent from "@/components/home/FolderContent";
import FolderOptionsButton from "@/components/home/FolderOptionsButton";

interface FolderPageProps {
    params: {
        id: string;
    };
}

export default async function FolderPage({ params }: FolderPageProps) {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
        redirect('/auth/login');
    }

    // Await params to fix Next.js 15 async params issue
    const { id } = await params;

    // Fetch folder details
    const folder = await prisma.folder.findFirst({
        where: {
            id: id,
            userId: session.user.id,
            isDeleted: false
        },
        select: {
            id: true,
            name: true,
            icon: true,
            createdAt: true,
            updatedAt: true,
            parentId: true,
            parent: {
                select: {
                    id: true,
                    name: true
                }
            },
            _count: {
                select: {
                    documents: {
                        where: {
                            isDeleted: false
                        }
                    },
                    children: {
                        where: {
                            isDeleted: false
                        }
                    }
                }
            }
        }
    });

    if (!folder) {
        notFound();
    }

    // Transform the data to include count
    const folderWithCount = {
        id: folder.id,
        name: folder.name,
        icon: folder.icon || undefined,
        count: folder._count.documents + folder._count.children
    };

    return (
        <div className="flex h-screen bg-white">
            {/* SideBar */}
            <ClientOnly fallback={
                <aside className="w-64 bg-white border-r border-black flex flex-col">
                    <div className="h-16 border-b border-black"></div>
                    <div className="p-4"></div>
                </aside>
            }>
                <Sidebar />
            </ClientOnly>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Header */}
                <ClientOnly fallback={
                    <header className="h-16 bg-white border-b border-black"></header>
                }>
                    <HomeHeader />
                </ClientOnly>

                {/* Content */}
                <main className="flex-1 overflow-y-auto px-8 py-6 bg-white">
                    {/* Breadcrumb */}
                    <div className="mb-6">
                        <nav className="flex items-center space-x-2 text-sm text-ink/60 mb-2">
                            <a href="/folders" className="hover:text-ink transition-colors">
                                Folders
                            </a>
                            {folder.parent && (
                                <>
                                    <span>/</span>
                                    <a href={`/folders/${folder.parent.id}`} className="hover:text-ink transition-colors">
                                        {folder.parent.name}
                                    </a>
                                </>
                            )}
                            <span>/</span>
                            <span className="text-ink font-medium">{folder.name}</span>
                        </nav>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-ink mb-2">{folder.name}</h1>
                                <p className="text-ink/60">
                                    Created {new Date(folder.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <ClientOnly fallback={<div className="w-32 h-10 bg-gray-200 rounded-lg animate-pulse"></div>}>
                                    <FolderOptionsButton folder={folderWithCount} />
                                </ClientOnly>
                            </div>
                        </div>
                    </div>
                    
                    <FolderContent folderId={folder.id} />
                </main>
            </div>
        </div>
    );
}
