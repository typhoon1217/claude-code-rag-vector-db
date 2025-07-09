# Local RAG Vector Database for Claude Code Performance Enhancement

## Project Overview
High-performance local RAG system using TypeScript/Node.js for fast context retrieval to enhance Claude Code responses.

## Repository
- **GitHub**: https://github.com/typhoon1217/claude-code-rag-vector-db
- **Issues**: https://github.com/typhoon1217/claude-code-rag-vector-db/issues
- **Wiki**: https://github.com/typhoon1217/claude-code-rag-vector-db/wiki

## Architecture
- **Runtime**: Node.js with TypeScript
- **Vector DB**: ChromaDB (HTTP client) or Qdrant (local)
- **Embeddings**: @xenova/transformers (local inference)
- **MCP Server**: @modelcontextprotocol/sdk
- **Performance**: In-memory caching, streaming responses

## Quick Start
```bash
git clone https://github.com/typhoon1217/claude-code-rag-vector-db.git
cd claude-code-rag-vector-db
npm install
npm run build
npm run index-codebase -- --path /your/project/path
npm run start-server
```

## Implementation Steps

### 1. Project Setup
```bash
npm install typescript @types/node ts-node
npm install chromadb @xenova/transformers
npm install @modelcontextprotocol/sdk
npm install glob fast-glob chokidar
```

### 2. Core Components

#### Vector Database Client (`src/vector/client.ts`)
```typescript
import { ChromaClient, Collection } from 'chromadb';
import { pipeline } from '@xenova/transformers';

class VectorStore {
  private client: ChromaClient;
  private embedder: any;
  
  async initialize() {
    this.client = new ChromaClient();
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  
  async addDocuments(documents: Document[]) {
    // Batch embedding and storage
  }
  
  async search(query: string, limit: number = 5) {
    // Vector similarity search
  }
}
```

#### Document Processor (`src/processors/codeProcessor.ts`)
```typescript
import { glob } from 'fast-glob';
import { readFile } from 'fs/promises';

class CodeProcessor {
  async processCodebase(path: string) {
    const files = await glob('**/*.{ts,js,py,java,cpp,h}', { cwd: path });
    
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const chunks = this.chunkCode(content, file);
      await this.vectorStore.addDocuments(chunks);
    }
  }
  
  private chunkCode(content: string, filepath: string): Document[] {
    // Smart code chunking by functions/classes
  }
}
```

#### MCP Server (`src/server/mcp.ts`)
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

class RAGServer {
  private server = new Server({
    name: 'rag-context',
    version: '1.0.0'
  });
  
  async start() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_codebase',
          description: 'Search codebase for relevant context',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number', default: 5 }
            }
          }
        }
      ]
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'search_codebase') {
        const results = await this.vectorStore.search(
          request.params.arguments.query,
          request.params.arguments.limit
        );
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      }
    });
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### 3. Project Structure
```
claude-code-rag-vector-db/
├── README.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── .gitignore
├── src/
│   ├── vector/
│   │   ├── client.ts
│   │   └── embeddings.ts
│   ├── processors/
│   │   ├── codeProcessor.ts
│   │   └── documentProcessor.ts
│   ├── server/
│   │   ├── mcp.ts
│   │   └── handlers.ts
│   └── utils/
│       ├── chunking.ts
│       └── cache.ts
├── data/
│   └── vector_store/
└── scripts/
    ├── index.ts
    └── server.ts
```

### 4. Configuration

#### `package.json` scripts
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/server/mcp.ts",
    "start-server": "node dist/server/mcp.js",
    "index-codebase": "ts-node scripts/index.ts",
    "test": "jest"
  }
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### 5. Claude Code Integration

Add to Claude Code config:
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

## Performance Optimizations

### Memory Management
- Stream large files instead of loading entirely
- LRU cache for embeddings
- Lazy loading of vector collections

### Search Optimization
- Pre-compute embeddings for common queries
- Use approximate nearest neighbor search
- Implement result caching

### Concurrency
- Worker threads for heavy embedding tasks
- Async/await throughout
- Connection pooling for vector DB

## Usage Examples

### Index your codebase
```bash
npm run index-codebase -- --path /home/user/my-project
```

### Start the MCP server
```bash
npm run start-server
```

### Test search
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication middleware", "limit": 3}'
```

## Commands Reference

### Development
```bash
npm run dev          # Start in development mode
npm run build        # Build TypeScript
npm run test         # Run tests
npm run lint         # Check code quality
```

### Production
```bash
npm run start-server # Start MCP server
npm run index-codebase -- --path /path/to/code
```

### Maintenance
```bash
npm run clean-cache  # Clear embedding cache
npm run reindex      # Re-index all documents
npm run health-check # Check server status
```

## Deployment

### GitHub Repository Setup
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/typhoon1217/claude-code-rag-vector-db.git
git push -u origin main
```

### Environment Variables
```bash
# Optional configuration
export MCP_RAG_PORT=3000
export MCP_RAG_DATA_PATH="./data/vector_store"
export NODE_OPTIONS="--max-old-space-size=4096"
```

## Troubleshooting

### Common Issues
- **Embedding model download**: First run downloads ~90MB model
- **Memory usage**: Large codebases may need increased Node heap size
- **Port conflicts**: Default port 3000, configurable via ENV

### Performance Tuning
```bash
# Increase Node.js heap size
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable V8 optimizations
export NODE_OPTIONS="--optimize-for-size"
```

## Contributing

### Development Workflow
1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a feature branch
4. Make your changes
5. Run tests and build
6. Submit a pull request

### Code Style
- Use TypeScript strict mode
- Follow ESLint configuration
- Add JSDoc comments for public APIs
- Include tests for new features

## License
MIT License - see LICENSE file for details

## Support
- GitHub Issues: https://github.com/typhoon1217/claude-code-rag-vector-db/issues
- Documentation: https://github.com/typhoon1217/claude-code-rag-vector-db/wiki
- Discussions: https://github.com/typhoon1217/claude-code-rag-vector-db/discussions