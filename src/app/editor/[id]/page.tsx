import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClientOnly from "@/components/ui/ClientOnly";
import CursorEditor from "@/components/editor/CursorEditor";

interface EditorPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
        redirect('/auth/login');
    }

    const { id } = await params;

    return (
        <div className="h-screen bg-white overflow-hidden">
            <ClientOnly fallback={
                <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
                        <p className="text-ink/70">Loading editor...</p>
                    </div>
                </div>
            }>
                <CursorEditor documentId={id} />
            </ClientOnly>
        </div>
    );
}
