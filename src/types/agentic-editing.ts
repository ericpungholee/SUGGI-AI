// New types for agentic editing system
export interface AgentTextBlock {
  id: string
  content: string
  startPosition: number
  endPosition: number
  isAgentText: boolean
  isApproved: boolean
  createdAt: Date
  approvedAt?: Date
  metadata?: {
    intent: string
    confidence: number
    source: 'agent' | 'user'
  }
}

export interface AgentTypingSession {
  id: string
  documentId: string
  isActive: boolean
  currentBlockId?: string
  blocks: AgentTextBlock[]
  startedAt: Date
  completedAt?: Date
  userIntent: string
}

export interface RealTimeEditState {
  isAgentTyping: boolean
  currentSession?: AgentTypingSession
  pendingApprovals: AgentTextBlock[]
  userTextBlocks: AgentTextBlock[]
}

export interface AgentTypingConfig {
  typingSpeed: number // milliseconds per character
  pauseBetweenWords: number // milliseconds
  pauseBetweenSentences: number // milliseconds
  maxBlockSize: number // max characters per typing block
}

export interface EditRequest {
  documentId: string
  scope: 'selection' | 'document'
  userIntent: string
  guardrails: {
    allowCodeEdits: boolean
    allowMathEdits: boolean
    preserveVoice: boolean
  }
}

export interface EditApprovalEvent {
  blockId: string
  action: 'approve' | 'reject'
  timestamp: Date
}

// Enhanced LangGraph state for real-time editing
export interface RealTimeEditAgentState {
  // Input
  userMessage: string
  documentId: string
  documentContent: string
  conversationHistory: Array<{role: string, content: string}>
  
  // Real-time editing state
  agentTypingSession: AgentTypingSession | null
  currentTypingBlock: AgentTextBlock | null
  
  // Processing state
  editRequest: EditRequest | null
  detectedIntent: string
  confidence: number
  
  // Edit generation
  editPlan: {
    approach: string
    changes: string[]
    guardrails: string[]
    typingStrategy: 'immediate' | 'gradual' | 'streaming'
  } | null
  
  // Output
  generatedContent: string
  typingBlocks: AgentTextBlock[]
  error: string | null
  
  // Metadata
  processingStep: string
  timestamp: Date
}
