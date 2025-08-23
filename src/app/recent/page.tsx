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
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-ink mb-2">Recent Documents</h1>
                        <p className="text-ink/60">Your recently modified documents</p>
                    </div>
                    
                    <RecentDocumentGrid />
                </main>
            </div>
        </div>
    );
}
