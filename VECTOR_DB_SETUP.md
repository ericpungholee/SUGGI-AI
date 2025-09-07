# Vector Database Setup for RAG

This guide will help you set up Pinecone as your vector database for Retrieval-Augmented Generation (RAG).

## 🚀 **Quick Setup**

### 1. **Create Pinecone Account**
1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Sign up for a free account
3. Create a new project

### 2. **Get API Credentials**
1. In Pinecone Console, go to "API Keys"
2. Copy your API key
3. Note your environment (e.g., `us-east-1`)

### 3. **Set Environment Variables**
Create a `.env.local` file in your project root:

```bash
# Pinecone Vector Database
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX_NAME="ssugi-docs"
```

### 4. **Test the Setup**
```bash
# Test vector database connection
curl "http://localhost:3000/api/test/vector?action=stats"
```

## 🏗️ **Architecture Overview**

### **RAG Flow:**
1. **Document Ingestion**: Documents are chunked and embedded
2. **Vector Storage**: Embeddings stored in Pinecone with metadata
3. **Query Processing**: User queries are embedded and searched
4. **Context Retrieval**: Most relevant chunks are retrieved
5. **AI Generation**: LLM generates responses using retrieved context

### **Data Flow:**
```
Document → Chunks → Embeddings → Pinecone → Search → Context → AI Response
```

## 📊 **Database Schema**

### **Pinecone Index: `ssugi-docs`**
- **Model**: text-embedding-3-small (integrated)
- **Cloud**: AWS
- **Region**: us-east-1
- **Field Mapping**: `text` → `content`
- **Metadata**:
  - `documentId`: Source document ID
  - `documentTitle`: Document title
  - `userId`: User who owns the document
  - `chunkIndex`: Order of chunk in document
  - `createdAt`: Timestamp

### **PostgreSQL (Metadata)**
- `documents`: Document metadata and content
- `document_chunks`: Chunk content and references
- `ai_conversations`: Chat history

## 🔧 **Configuration Options**

### **Chunking Strategy**
- **Size**: 1000 characters per chunk
- **Overlap**: 200 characters between chunks
- **Boundary**: Tries to break at sentences or paragraphs

### **Search Parameters**
- **Top K**: Number of results to return (default: 10)
- **Threshold**: Minimum similarity score (default: 0.7)
- **Filtering**: By user ID and document ID

## 🧪 **Testing**

### **Test Endpoints:**
```bash
# Get statistics
GET /api/test/vector?action=stats

# Search documents
GET /api/test/vector?action=search&q=your_query

# Manual vectorization
POST /api/documents/[id]/vectorize
```

### **Expected Response:**
```json
{
  "stats": {
    "totalDocuments": 5,
    "vectorizedDocuments": 3,
    "totalChunks": 15
  },
  "vectorStats": {
    "totalChunks": 15,
    "totalDocuments": 3
  },
  "documents": [...],
  "sampleChunks": [...]
}
```

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **"Vector database initialization failed"**
   - Check `PINECONE_API_KEY` is set correctly
   - Verify environment name matches Pinecone console

2. **"Index not found"**
   - Index will be created automatically on first use
   - Wait for index to be ready (can take a few minutes)

3. **"Failed to search vector database"**
   - Check if documents have been vectorized
   - Verify user has documents in the system

### **Debug Mode:**
Enable detailed logging by setting:
```bash
NODE_ENV=development
```

## 📈 **Performance Optimization**

### **Index Configuration:**
- **Serverless**: Auto-scaling, pay-per-use
- **Region**: Choose closest to your users
- **Replicas**: 1 (sufficient for most use cases)

### **Search Optimization:**
- Use filters to narrow search scope
- Implement result caching for frequent queries
- Consider batch operations for bulk updates

## 🔒 **Security**

### **Access Control:**
- All operations filtered by `userId`
- API keys stored securely in environment variables
- No direct database access from client

### **Data Privacy:**
- User data isolated by `userId` filter
- No cross-user data leakage
- Embeddings don't contain raw text

## 📚 **Next Steps**

1. **Set up Pinecone account** and get API key
2. **Add environment variables** to `.env.local`
3. **Test the setup** with the test endpoints
4. **Create some documents** and verify vectorization
5. **Test AI chat** with document context

The system will now use Pinecone for fast, scalable vector search, enabling proper RAG functionality!
