import HomeHeader from "@/components/home/HomeHeader";
import Sidebar from "@/components/home/Sidebar";
import DocumentGrid from "@/components/home/DocumentGrid";
import FolderGrid from "@/components/home/FolderGrid";

export default function Home() {
    return (
        <div className="flex h-screen bg-stone-light">
            {/* SideBar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <HomeHeader />

                {/* Content */}
                <main className="flex-1 overflow-y-auto px-8 py-6">
                    {/* Folders */ }
                    <section className="mb-8">
                        <h2 className="text-lg font-medium text-ink/70 mb-4">Folders</h2>
                        <FolderGrid />
                    </section>
                    
                    {/* Documents */}
                    <section className="mb-8">
                        <h2 className="text-lg font-medium text-ink/70 mb-4">Documents</h2>
                        <DocumentGrid />
                    </section>
                </main>
            </div>
        </div>
    )
}