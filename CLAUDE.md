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
# 1. Install and start ChromaDB
pip install chromadb
chroma run --host localhost --port 8000

# 2. Setup the project
git clone https://github.com/typhoon1217/claude-code-rag-vector-db.git
cd claude-code-rag-vector-db
npm install
npm run build

# 3. Index your codebase
npm run index-codebase -- --path /your/project/path

# 4. Start MCP server
npm run start-server
```

## Implementation Steps

### 1. Project Setup
```bash
# Install dependencies
npm install typescript @types/node ts-node
npm install chromadb @xenova/transformers
npm install @modelcontextprotocol/sdk
npm install glob fast-glob chokidar

# External dependency: ChromaDB server
pip install chromadb
```

### 2. Core Components

#### Vector Database Client (`src/vector/client.ts`)
```typescript
import { ChromaClient } from 'chromadb';
import { pipeline } from '@xenova/transformers';

export class VectorStore {
  private client: ChromaClient;
  private embedder: any;
  private collectionName = 'codebase';
  
  constructor(private chromaUrl: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: this.chromaUrl });
  }
  
  async initialize() {
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName
    });
  }
  
  async addDocuments(documents: Document[]) {
    const embeddings = await this.generateEmbeddings(documents.map(d => d.content));
    await this.collection.add({
      ids: documents.map(d => d.id),
      embeddings,
      metadatas: documents.map(d => d.metadata)
    });
  }
  
  async search(query: string, limit: number = 5) {
    const queryEmbedding = await this.generateEmbeddings([query]);
    return await this.collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: limit
    });
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
import { VectorStore } from '../vector/client.js';
import { CodeProcessor } from '../processors/codeProcessor.js';

export class RAGServer {
  private server: Server;
  private vectorStore: VectorStore;
  private codeProcessor: CodeProcessor;
  
  constructor() {
    this.server = new Server({
      name: 'rag-context',
      version: '1.0.0'
    });
    this.vectorStore = new VectorStore('http://localhost:8000');
    this.codeProcessor = new CodeProcessor();
  }
  
  async start() {
    // Setup MCP tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_codebase',
          description: 'Search through indexed codebase',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number', default: 5 }
            }
          }
        },
        {
          name: 'index_codebase',
          description: 'Index a codebase directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            }
          }
        },
        {
          name: 'get_index_stats',
          description: 'Get database statistics'
        },
        {
          name: 'clear_index',
          description: 'Clear the vector database'
        }
      ]
    }));
    
    // Connect via stdio transport
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
        "args": ["dist/src/server/mcp.js"],
        "cwd": "/path/to/claude-code-rag-vector-db"
      }
    }
  }
}
```

**Prerequisites:**
1. ChromaDB server running: `chroma run --host localhost --port 8000`
2. MCP server built: `npm run build`
3. Codebase indexed: `npm run index-codebase -- --path /your/project`

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

### Test MCP integration
```bash
# Search is only available through Claude Code MCP integration
# Once configured, Claude Code will have access to:
# - search_codebase
# - index_codebase  
# - get_index_stats
# - clear_index
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
# 1. Start ChromaDB server
chroma run --host localhost --port 8000

# 2. Start MCP server
npm run start-server

# 3. Index codebase
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
export CHROMA_HOST="localhost"
export CHROMA_PORT="8000"
export MCP_RAG_DATA_PATH="./data/vector_store"
export NODE_OPTIONS="--max-old-space-size=4096"
```

## Troubleshooting

### Common Issues
- **ChromaDB connection**: Ensure ChromaDB server is running on port 8000
- **Embedding model download**: First run downloads ~90MB model
- **Memory usage**: Large codebases may need increased Node heap size
- **MCP integration**: Ensure correct path to `dist/src/server/mcp.js`

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