import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientOnly from "@/components/ui/ClientOnly";
import Sidebar from "@/components/home/Sidebar";
import HomeHeader from "@/components/home/HomeHeader";
import RecentDocumentGrid from "@/components/home/RecentDocumentGrid";

export default async function RecentPage() {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
        redirect('/auth/login');
    }

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
                    <HomeHeader title="Recent Documents" />
                </ClientOnly>

                {/* Content */}
                <main className="flex-1 overflow-y-auto px-8 py-6 bg-white">
                    <RecentDocumentGrid />
                </main>
            </div>
        </div>
    );
}
