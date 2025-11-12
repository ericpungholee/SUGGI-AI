import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClientOnly from "@/components/ui/ClientOnly";
import Sidebar from "@/components/home/Sidebar";
import DocumentsPageWrapper from "@/components/documents/DocumentsPageWrapper";

export default async function AllDocumentsPage() {
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
                <ClientOnly fallback={
                    <>
                        <header className="h-16 bg-white border-b border-black"></header>
                        <main className="flex-1 overflow-y-auto px-8 py-6 bg-white">
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-ink mb-2">All Documents</h1>
                                <p className="text-ink/60">View and manage all your documents</p>
                            </div>
                        </main>
                    </>
                }>
                    <DocumentsPageWrapper />
                </ClientOnly>
            </div>
        </div>
    );
}
