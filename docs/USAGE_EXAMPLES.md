# Claude Code RAG Vector Database - Usage Examples

## Quick Start Example

### 1. Install and Build
```bash
# Clone the repository
git clone https://github.com/typhoon1217/claude-code-rag-vector-db.git
cd claude-code-rag-vector-db

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Start ChromaDB (using Docker)
```bash
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
```

### 3. Index Your Codebase
```bash
# Index a TypeScript project
npm run index-codebase -- --path /path/to/your/project

# Example output:
# 🚀 Initializing vector database...
# 📊 Loading embedding model...
# 📁 Indexing codebase at: /path/to/your/project
# ✅ Indexed 150 files (2,341 chunks) in 45.2s
```

### 4. Start the MCP Server
```bash
npm run start-server

# Server starts on stdio for MCP communication
```

### 5. Configure Claude Code
Add to your Claude Code configuration:
```json
{
  "mcp": {
    "servers": {
      "rag-context": {
        "command": "node",
        "args": ["dist/server/mcp.js"],
        "cwd": "/path/to/claude-code-rag-vector-db"
      }
    }
  }
}
```

## Real-World Usage Examples

### Example 1: Finding Authentication Implementation

**In Claude Code:**
```
Claude, show me how authentication is implemented in this codebase
```

**Behind the scenes, the MCP server:**
1. Receives the query via `search_codebase` tool
2. Generates embeddings for "authentication implementation"
3. Searches vector database for similar code chunks
4. Returns relevant code sections

**Result provided to Claude:**
```json
{
  "results": [
    {
      "filepath": "src/auth.ts",
      "content": "export class AuthenticationService {\\n  async login(email: string, password: string): Promise<AuthToken> {\\n    const user = await this.db.users.findByEmail(email);\\n    if (!user) throw new Error('User not found');\\n    ...",
      "relevance": 0.92,
      "metadata": {
        "type": "class",
        "name": "AuthenticationService",
        "startLine": 15
      }
    },
    {
      "filepath": "src/middleware/auth.ts",
      "content": "export async function authenticate(req: Request, res: Response, next: NextFunction) {\\n  const token = req.headers.authorization?.replace('Bearer ', '');\\n  ...",
      "relevance": 0.87,
      "metadata": {
        "type": "function",
        "name": "authenticate",
        "startLine": 8
      }
    }
  ]
}
```

### Example 2: Understanding Database Architecture

**Query:**
```
How does the database connection pooling work?
```

**MCP Server Process:**
```typescript
// 1. Semantic search for "database connection pooling"
const results = await vectorStore.search(
  "database connection pooling",
  { limit: 5, threshold: 0.7 }
);

// 2. Returns relevant database configuration and pool management code
// 3. Claude Code receives focused context instead of entire database module
```

### Example 3: Finding Error Handling Patterns

**Query:**
```
Show me all error handling implementations in the API layer
```

**Traditional approach (slow):**
- Claude Code would need to read all API files
- Parse and understand error handling patterns
- High token usage

**With RAG (fast):**
- Semantic search finds all error handling code
- Returns only relevant chunks
- 80% less context needed

## Advanced Usage Patterns

### 1. Multi-Stage Searches

```typescript
// First, find all authentication-related code
const authCode = await search("authentication and authorization");

// Then, find specific JWT implementations within auth code
const jwtCode = await search("JWT token generation and validation", {
  filterByFiles: authCode.map(r => r.filepath)
});
```

### 2. Caching Common Queries

The system automatically caches embeddings for frequently used queries:

```typescript
// First search: 9.32ms (generates embeddings)
await search("user authentication flow");

// Subsequent searches: 5.33ms (uses cached embeddings)
await search("user authentication flow");
```

### 3. Semantic Code Navigation

Find related code even with different terminology:

```typescript
// Query: "user login process"
// Finds: authenticate(), signIn(), validateCredentials()

// Query: "database transactions"  
// Finds: beginTransaction(), rollback(), commit()
```

## Integration Examples

### With Claude Code Commands

```bash
# Ask Claude to explain authentication
claude "Explain how user authentication works in this codebase"

# The RAG system provides focused context, making Claude's response:
# - Faster (less processing needed)
# - More accurate (relevant code provided)
# - Cheaper (fewer tokens used)
```

### In Development Workflows

```typescript
// Before making changes
const currentImpl = await search("payment processing implementation");

// After changes, verify impact
const affectedCode = await search("code that calls payment processing");
```

## Performance Optimization Examples

### 1. Batch Indexing

```bash
# Index multiple projects efficiently
npm run index-codebase -- --path /workspace/project1
npm run index-codebase -- --path /workspace/project2 --append
```

### 2. Incremental Updates

```typescript
// Watch for file changes and update index
watcher.on('change', async (filepath) => {
  await vectorStore.updateDocument(filepath);
});
```

### 3. Query Optimization

```typescript
// Use specific queries for better results
❌ await search("error"); // Too generic

✅ await search("API error handling middleware"); // Specific and semantic
```

## Troubleshooting Examples

### Issue: Slow Initial Query
```bash
# Solution: Pre-warm the cache
npm run warm-cache -- --queries common-queries.json
```

### Issue: Missing Results
```typescript
// Check if files are indexed
const stats = await vectorStore.getIndexStats();
console.log(`Indexed files: ${stats.documentCount}`);
console.log(`Total chunks: ${stats.chunkCount}`);
```

### Issue: High Memory Usage
```bash
# Use streaming for large codebases
npm run index-codebase -- --path /huge/project --stream --batch-size 10
```

## Example Output Comparison

### Without RAG:
```
Claude: "Let me search for authentication code..."
[Reads 50+ files, 100K+ tokens]
"I found authentication logic in several files..."
Time: 15-30 seconds
```

### With RAG:
```
Claude: "I'll search for authentication code..."
[Receives 5 relevant code chunks, 5K tokens]
"Here's how authentication is implemented..."
Time: 2-5 seconds
```

## Best Practices

1. **Index Regularly**: Keep the vector database updated
   ```bash
   # Add to your git hooks
   npm run index-codebase -- --path . --incremental
   ```

2. **Use Semantic Queries**: Describe what you're looking for
   ```
   ✅ "user registration and validation flow"
   ❌ "register function"
   ```

3. **Monitor Performance**: Track improvements
   ```bash
   npm run benchmark -- --compare-before-after
   ```

These examples demonstrate how the Claude Code RAG Vector Database significantly improves code search and understanding performance in real-world scenarios.