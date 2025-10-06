# SUGGI-AI - All-in-One AI Writing Platform

**The writing app that actually gets it.**

I built SUGGI-AI because I was tired of the writing workflow that everyone else seems to accept. You know the drill: write in Notion, but there's no proper home page to see all your documents. Need AI help? Switch to ChatGPT tab. Need context from another document? Flip between tabs constantly. It's a mess.

SUGGI-AI fixes this by putting everything in one place: your documents, AI chat, and context - all working together seamlessly.

## 🎯 The Problem I Solved

**Notion's Missing Home Page**: Notion doesn't have a proper dashboard to see all your documents at a glance. You're stuck navigating through folders or using the search.

**Tab Switching Hell**: Need AI help? Switch to ChatGPT. Need to reference another document? Switch back. Need to edit? Switch again. It's exhausting.

**Context Fragmentation**: Your AI doesn't know about your other documents. You have to copy-paste content or explain context every time.

**SUGGI-AI fixes all of this** with a unified workspace where your documents, AI assistant, and context live together.

## ✨ What Makes SUGGI-AI Different

### 🏠 **Proper Home Dashboard**
- See all your documents at a glance (unlike Notion's cluttered interface)
- Recent documents, starred items, and quick access
- Visual document grid with thumbnails and metadata
- Search across all documents instantly

### 🤖 **AI That Actually Knows Your Content**
- AI chat that understands ALL your documents, not just the current one
- Ask questions about any document without switching tabs
- Get suggestions based on your entire knowledge base
- AI can reference and compare content across documents

### 🔄 **No More Tab Switching**
- Write, chat with AI, and reference documents all in one interface
- AI assistant panel that stays open while you write
- Real-time editing suggestions that don't interrupt your flow
- Context from other documents available instantly

### ⚡ **Smart & Fast**
- Sub-second AI responses using GPT-5 nano
- Vector search across all your content
- Intelligent query routing (edit requests vs. questions)
- Cached responses for faster performance

## 🛠 Core Features

### **Writing Experience**
- Clean, distraction-free editor (Google Docs style)
- Rich text formatting with toolbar
- Auto-save with version history
- Undo/redo with full history
- Document outline and navigation
- Keyboard shortcuts for power users

### **AI Integration**
- Context-aware chat that knows your documents
- Real-time content generation and editing
- Smart query classification (knows when you want to edit vs. ask questions)
- Web search when you need current information
- Conversation memory across sessions

### **Document Management**
- Hierarchical folder organization
- Visual document grid with thumbnails
- Search across all documents
- Star important documents
- Recent documents quick access
- Document versioning and history

### **Advanced AI Features**
- RAG (Retrieval-Augmented Generation) for accurate responses
- Vector search using Pinecone (3072-dim embeddings)
- Document chunking and semantic search
- Edit proposals with diff-based approvals
- Style preservation in AI-generated content

## 🛠 Tech Stack

### **Frontend**
- **Next.js 15** + **React 19** - Modern React with App Router for SSR/SSG
- **TypeScript** - Type-safe development with strict typing
- **Tailwind CSS 4** - Utility-first styling with custom design system
- **Lucide React** - Clean, consistent icon library

### **Backend & Database**
- **Next.js API Routes** - Serverless backend with edge functions
- **Prisma ORM** - Type-safe database access with migrations
- **PostgreSQL** - Primary database for documents, users, and metadata
- **NextAuth.js** - Authentication with OAuth providers

### **AI & Machine Learning**
- **OpenAI GPT-5** - Latest model (August 2025) with unified architecture and 256K context window
- **OpenAI text-embedding-3-large** - Document embeddings (3072 dimensions)
- **Pinecone** - Vector database for semantic search and similarity matching
- **LangGraph** - Advanced AI agent workflows with stateful, multi-step processing
- **RAG Orchestrator** - Intelligent retrieval-augmented generation system
- **Hybrid Learned Router** - Smart query classification and intent detection

### **Performance & Optimization**
- **Vector Search** - Sub-second document retrieval using Pinecone
- **Query Classification** - Smart routing with hybrid learned router
- **Response Caching** - Intelligent caching system for repeated queries
- **LangGraph Workflows** - Stateful, multi-step AI processing with conditional logic
- **Document Chunking** - Adaptive chunking strategy for optimal RAG performance
- **Web Search Integration** - Robust web search with timeout handling and fallback
- **Incremental Vectorization** - Efficient document processing and updates

## 🔧 Technical Challenges & Solutions

### **Challenge 1: Context-Aware AI Across All Documents**
**Problem**: Traditional AI chat only knows about the current document. Users had to copy-paste content or explain context every time.

**Solution**: Built a RAG (Retrieval-Augmented Generation) pipeline:
- **Document Vectorization**: All documents are chunked and embedded using `text-embedding-3-large` (3072 dimensions)
- **Pinecone Vector DB**: Stores embeddings with metadata for fast semantic search
- **Context Retrieval**: AI queries search across ALL user documents, not just current one
- **Smart Chunking**: Adaptive chunking strategy that respects document structure

### **Challenge 2: Sub-Second AI Responses**
**Problem**: AI responses were slow, especially with context retrieval and processing.

**Solution**: Multi-layered performance optimization:
- **LangGraph Workflows**: Stateful, multi-step AI processing with conditional logic
- **Hybrid Learned Router**: Smart query classification and intent detection
- **Response caching**: Conversation memory with intelligent cache management
- **Vector search optimization**: Pinecone provides sub-second semantic search
- **RAG Orchestrator**: Intelligent retrieval-augmented generation system
- **Web Search Integration**: Robust web search with timeout handling and fallback

### **Challenge 3: Real-Time Editing with Style Preservation**
**Problem**: AI editing often breaks the user's writing style and voice.

**Solution**: Advanced edit detection and approval system:
- **Diff-based editing**: AI generates precise text diffs, not full rewrites
- **Style preservation**: AI maintains user's voice and writing patterns
- **Approval workflow**: Users can approve/reject changes before applying
- **Real-time typing simulation**: Natural typing animation for generated content
- **Version control**: Full edit history with rollback capability

### **Challenge 4: Unified Interface Without Tab Switching**
**Problem**: Users constantly switch between writing, AI chat, and document reference.

**Solution**: Integrated workspace design:
- **Persistent AI panel**: Stays open while writing, no switching needed
- **Context-aware chat**: AI knows about current document AND all other documents
- **Document home dashboard**: Visual grid showing all documents at once
- **Seamless navigation**: Quick access to any document without losing context

### **Challenge 5: Cost-Effective AI Usage**
**Problem**: AI API costs can spiral out of control with heavy usage.

**Solution**: Intelligent cost optimization:
- **Hybrid Learned Router**: Smart query classification and intent detection
- **Response deduplication**: Caches similar queries to avoid redundant API calls
- **Context compression**: Reduces token usage while maintaining quality
- **LangGraph Workflows**: Efficient stateful processing with conditional logic
- **RAG Orchestrator**: Optimized retrieval-augmented generation system

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Pinecone account (for vector search)
- OpenAI API key

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/suggi-ai"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=suggi-ai-docs
```

### Installation
```bash
# Clone and install
git clone <repository-url>
cd suggi-ai
npm install

# Setup database
npm run db:generate
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start writing!

## 🎯 How It Works

### **1. Document Home Dashboard**
- All your documents in one visual grid
- Recent, starred, and organized by folders
- Quick search across everything
- No more hunting through Notion's interface

### **2. AI That Knows Your Content**
- AI chat understands ALL your documents
- Ask questions about any document without switching
- Get suggestions based on your entire knowledge base
- AI can reference and compare across documents

### **3. Unified Writing Experience**
- Write in the editor
- AI assistant panel stays open
- Real-time suggestions and editing
- Context from other documents available instantly

### **4. Smart Performance**
- GPT-5 with 256K context window for comprehensive understanding
- LangGraph workflows for stateful, multi-step AI processing
- Vector search for instant document retrieval
- Cached responses for repeated queries
- Hybrid learned router for smart query classification

## 💡 Why I Built This

I was frustrated with the current writing workflow:

1. **Notion's cluttered interface** - No proper home page to see all documents
2. **Constant tab switching** - Write in Notion, AI help in ChatGPT, reference docs in another tab
3. **Lost context** - AI doesn't know about your other documents
4. **Fragmented experience** - Everything is separate, nothing works together

So I built SUGGI-AI to solve these problems:

- **Proper home dashboard** - See all your documents at a glance
- **Unified interface** - Write, chat with AI, and reference docs all in one place
- **Context-aware AI** - AI knows about ALL your documents, not just the current one
- **No more tab switching** - Everything works together seamlessly

## 🔧 Setup

### Pinecone Setup
1. Create account at [pinecone.io](https://pinecone.io)
2. Create index named `suggi-ai-docs` with 3072 dimensions
3. Add API key to environment variables

### OpenAI Setup
1. Get API key from [OpenAI](https://platform.openai.com)
2. Ensure access to GPT-5 and text-embedding-3-large
3. Add API key to environment variables

## 🚀 Recent Improvements (2025)

### **LangGraph Migration**
- **Migrated to LangGraph**: Advanced AI agent workflows with stateful, multi-step processing
- **ROUTE → RETRIEVE_CONTEXT → PLAN → EXECUTE → END**: Streamlined workflow pipeline
- **Conditional Logic**: Smart decision-making based on query type and context
- **Better Accuracy**: Improved AI responses through structured workflow management

### **Enhanced Web Search**
- **GPT-5 Integration**: Latest model with 256K context window and unified architecture
- **Robust Timeout Handling**: 45s timeout with automatic fallback for reliability
- **Error Recovery**: Graceful handling of "Request was aborted" errors
- **Fallback System**: Automatic retry with simpler queries when main search fails

### **Codebase Optimization**
- **Cleaned Up**: Removed duplicate implementations and unused test code
- **50% Fewer Files**: Streamlined from 32 to 16 core AI files
- **Self-Contained**: No external dependencies on deleted utility files
- **Production Ready**: Clean, focused codebase with clear separation of concerns

### **RAG System Enhancement**
- **RAG Orchestrator**: Intelligent retrieval-augmented generation system
- **Hybrid Learned Router**: Smart query classification and intent detection
- **Incremental Vectorization**: Efficient document processing and updates
- **Context Compression**: AI-powered context summarization to reduce tokens

## 🎯 The Bottom Line

SUGGI-AI is what happens when you get tired of the fragmented writing experience and decide to build something better. It's not just another writing app - it's a unified workspace where your documents, AI assistant, and context all work together.

**No more tab switching. No more lost context. No more hunting through cluttered interfaces.**

Just write, with AI that actually understands your content.

---

**Built with ❤️ because the current writing workflow is broken.**