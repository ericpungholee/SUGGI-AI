import { AgentEditManager } from '../AgentEditManager'

export interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  width: number
  documentId?: string
  onApplyChanges?: (changes: any, cursorPosition?: string) => void
  editorRef?: React.RefObject<HTMLDivElement | null>
  documentContent?: string
  agentEditManager?: AgentEditManager // Currently unused - useMessageHandlers applies edits directly
  onContentChange?: (content: string) => void
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'approval'
  content: string
  timestamp: Date
  previewOps?: any
  approvalData?: {
    pendingChangeId: string
    summary: string
    sources: string[]
    canApprove: boolean
    canDeny: boolean
    patch?: string
    oldContent?: string
    newContent?: string
    cursorPosition?: string
  }
}

export interface AppliedEditInfo {
  originalContent: string
  editId: string
  patch?: string
}

