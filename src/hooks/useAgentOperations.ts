import { useState, useCallback } from 'react';
import { AgentTextBlock, AgentTypingSession } from '@/types';
import { createEditorAgent, AIEditorAgent } from '@/lib/ai/editor-agent';

export interface UseAgentOperationsProps {
    editorRef: React.RefObject<HTMLDivElement>;
    onContentChange?: (content: string) => void;
}

export function useAgentOperations({
    editorRef,
    onContentChange
}: UseAgentOperationsProps) {
    
    // Agentic editing state
    const [agentBlocks, setAgentBlocks] = useState<AgentTextBlock[]>([]);
    const [currentAgentBlock, setCurrentAgentBlock] = useState<AgentTextBlock | null>(null);
    const [agentTypingProgress, setAgentTypingProgress] = useState(0);
    const [agentTypingSession, setAgentTypingSession] = useState<AgentTypingSession | null>(null);
    const [isAgentTyping, setIsAgentTyping] = useState(false);

    // Create AI Editor Agent - use state to manage agent creation
    const [editorAgent, setEditorAgent] = useState<AIEditorAgent | null>(null);
    
    // Create editor agent when ref becomes available
    useEffect(() => {
        if (editorRef.current && !editorAgent) {
            console.log('🔍 Creating editor agent:', {
                hasEditorRef: !!editorRef.current,
                editorRefType: typeof editorRef,
                hasOnContentChange: !!onContentChange
            });
            
            const agent = createEditorAgent(editorRef as React.RefObject<HTMLDivElement>, onContentChange);
            console.log('✅ Editor agent created:', {
                hasWriteContent: typeof agent.writeContent === 'function',
                agentType: typeof agent
            });
            setEditorAgent(agent);
        }
    }, [editorRef.current, onContentChange, editorAgent]);

    // Start agent typing session - direct editor manipulation
    const startAgentTyping = useCallback((content: string) => {
        if (!editorRef.current) {
            console.error('❌ Editor reference is null, cannot write content');
            return;
        }

        const sessionId = `session-${Date.now()}`;
        console.log('🤖 AI Agent writing to editor:', content.substring(0, 100) + '...');

        try {
            // Write content directly to the editor
            const editor = editorRef.current;
            const currentContent = editor.innerHTML || '';
            
            // Format content as markdown and append to editor
            const formattedContent = editorAgent?.formatAsMarkdown(content) || content;
            const newContent = currentContent + (currentContent ? '\n\n' : '') + formattedContent;
            
            // Update the editor content
            editor.innerHTML = newContent;
            
            // Trigger content change callback
            if (onContentChange) {
                onContentChange(newContent);
            }

            // Update document state for tracking
            const newBlock: AgentTextBlock = {
                id: `block-${Date.now()}`,
                content: content,
                position: editor.textContent?.length || 0 - content.length,
                isActive: false,
                isTyping: false,
                isApproved: true,
                timestamp: new Date()
            };

            const newSession: AgentTypingSession = {
                id: sessionId,
                blocks: [newBlock],
                isActive: false,
                startTime: new Date(),
                endTime: new Date()
            };

            setAgentTypingSession(newSession);
            setAgentBlocks([newBlock]);
            setIsAgentTyping(false);

            console.log('✅ AI Agent completed writing to editor');
        } catch (error) {
            console.error('❌ Error writing content to editor:', error);
        }
    }, [editorAgent, onContentChange, editorRef]);

    // Stop agent typing
    const stopAgentTyping = useCallback(() => {
        setIsAgentTyping(false);
        setCurrentAgentBlock(null);
        setAgentTypingSession(prev => prev ? { ...prev, isActive: false, endTime: new Date() } : null);
        console.log('Stopped agent typing');
    }, []);

    // Agentic editing handlers
    const handleAgentTextInserted = useCallback((block: AgentTextBlock, position: { start: number; end: number }) => {
        console.log('Agent text inserted:', block.id, position);
        // Text is already inserted by AgentTextManager
    }, []);

    const handleAgentTextRemoved = useCallback((blockId: string) => {
        console.log('Agent text removed:', blockId);
        setAgentBlocks(prev => prev.filter(block => block.id !== blockId));
    }, []);

    const handleApproveBlock = useCallback((blockId: string) => {
        setAgentBlocks(prev => prev.map(block => 
            block.id === blockId ? { ...block, isApproved: true } : block
        ));
        console.log('Block approved:', blockId);
    }, []);

    const handleRejectBlock = useCallback((blockId: string) => {
        setAgentBlocks(prev => prev.filter(block => block.id !== blockId));
        console.log('Block rejected:', blockId);
    }, []);

    const handleBlockClick = useCallback((block: AgentTextBlock) => {
        console.log('Block clicked:', block.id);
        // Could add more interaction here
    }, []);

    return {
        // State
        agentBlocks,
        setAgentBlocks,
        currentAgentBlock,
        setCurrentAgentBlock,
        agentTypingProgress,
        setAgentTypingProgress,
        agentTypingSession,
        setAgentTypingSession,
        isAgentTyping,
        setIsAgentTyping,
        
        // Agent
        editorAgent,
        
        // Functions
        startAgentTyping,
        stopAgentTyping,
        handleAgentTextInserted,
        handleAgentTextRemoved,
        handleApproveBlock,
        handleRejectBlock,
        handleBlockClick
    };
}
