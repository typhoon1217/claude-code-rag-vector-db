# Claude Code RAG Vector Database for Large-Scale Codebases

> **⚠️ Important**: This tool is optimized for **large codebases (100MB+)**. For smaller codebases, traditional search tools like grep or ripgrep will be significantly faster. See our [benchmark analysis](docs/PERFORMANCE_ANALYSIS.md) for details.

A high-performance Model Context Protocol (MCP) server that enhances Claude Code with local vector search capabilities for massive codebases where traditional search becomes inefficient.

## 🎯 When to Use This Tool

### ✅ Ideal for:
- **Large codebases** (100MB+ or 10,000+ files)
- **Monorepos** with millions of lines of code
- **Complex projects** where grep becomes slow (>1s search time)
- **Semantic search** needs ("find authentication logic" vs exact string match)
- **Cross-language** codebases requiring unified search

### ❌ Not recommended for:
- Small to medium projects (<100MB)
- Codebases where grep/ripgrep takes <500ms
- Simple string matching needs
- Projects with <1,000 files

## 🚀 Performance Benefits (Large Codebases Only)

For codebases >100MB, expect:
- **3-10x faster** search compared to grep
- **Semantic understanding** of code relationships
- **80% cache hit rate** for repeated queries
- **90% reduction** in Claude Code context usage

[See detailed performance analysis →](docs/PERFORMANCE_ANALYSIS.md)

## 🎯 Features

- **Local Vector Search**: ChromaDB integration for fast semantic code search
- **Smart Code Chunking**: Preserves function/class boundaries
- **Intelligent Caching**: 80% cache hit rate for common queries
- **MCP Integration**: Seamless integration with Claude Code
- **Language Support**: TypeScript, JavaScript, Python, Java, C++, and more

## 📊 Performance Characteristics

### Small Codebases (<100MB)
| Search Method | Average Response | Overhead |
|--------------|------------------|----------|
| grep/ripgrep | 1-10ms | None |
| RAG Vector Search | 5-10ms | 4-9x slower |

### Large Codebases (>1GB)
| Search Method | Average Response | Improvement |
|--------------|------------------|-------------|
| grep (cold) | 500-5000ms | Baseline |
| RAG (cold) | 50-200ms | 3-10x faster |
| RAG (warm) | 10-50ms | 10-100x faster |

[See usage examples →](docs/USAGE_EXAMPLES.md)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Claude Code installed
- **A large codebase** (100MB+ recommended)
- At least 4GB RAM for indexing large projects

### Installation
```bash
git clone https://github.com/typhoon1217/claude-code-rag-vector-db.git
cd claude-code-rag-vector-db
npm install
npm run build
```

### Setup Aliases (Recommended)

#### Option 1: Add to your ~/.zshrc (Standard)
```bash
# Add these aliases to your ~/.zshrc file
export MCP_PROJECT_PATH="/path/to/claude-code-rag-vector-db"

# Core MCP aliases
alias mcp-index='(cd $MCP_PROJECT_PATH && npm run index-codebase -- --path $(pwd))'
alias mcp-start='(cd $MCP_PROJECT_PATH && npm run start-server)'
alias mcp-stop='pkill -f "node dist/server/mcp.js"'
alias mcp-restart='mcp-stop && sleep 2 && mcp-start'
alias mcp-setup-project='mcp-index && mcp-start'
alias mcp-search='function _mcp_search() { curl -X POST http://localhost:3000/search -H "Content-Type: application/json" -d "{\"query\":\"$1\",\"limit\":${2:-5}}" 2>/dev/null | jq . || echo "Server not running"; }; _mcp_search'

# Then reload your shell
source ~/.zshrc
```

#### Option 2: For your specific setup (~/.config/zsh/alias/mcp.zsh)
```bash
# If you have a custom alias organization like ~/.config/zsh/alias/
# Copy the provided mcp.zsh file and update the path:
export MCP_PROJECT_PATH="/path/to/claude-code-rag-vector-db"

# Then source it in your shell configuration
echo "source ~/.config/zsh/alias/mcp.zsh" >> ~/.zshrc
```

#### Option 3: Manual setup (No aliases)
```bash
# Navigate to project directory
cd /path/to/claude-code-rag-vector-db

# Index current project
npm run index-codebase -- --path $(pwd)

# Start server
npm run start-server
```

## 📖 User Manual

### Basic Usage

#### 1. Index Your Project
Navigate to any project directory and run:
```bash
mcp-index
```
This indexes the current directory for semantic search.

#### 2. Start the MCP Server
```bash
mcp-start
```
Starts the RAG server that Claude Code will connect to.

#### 3. Search Your Codebase
```bash
mcp-search "authentication middleware"
mcp-search "database connection" 5  # limit to 5 results
```

### Complete Workflow
```bash
# Navigate to your project
cd /path/to/your/project

# Index and start server in one command
mcp-setup-project

# Search for relevant code
mcp-search "error handling"

# When done, stop the server
mcp-stop
```

### Claude Code Integration

Add this to your Claude Code configuration:
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

After configuration, Claude Code will automatically use your indexed codebase for better context understanding.

## 🛠️ Command Reference

### Essential Commands

| Command | Description | Example |
|---------|-------------|---------|
| `mcp-index` | Index current project | `mcp-index` |
| `mcp-setup-project` | Index + start server | `mcp-setup-project` |
| `mcp-search "query"` | Search indexed content | `mcp-search "login"` |
| `mcp-start` | Start MCP server | `mcp-start` |
| `mcp-stop` | Stop MCP server | `mcp-stop` |
| `mcp-restart` | Restart server | `mcp-restart` |

### Server Management

| Command | Description |
|---------|-------------|
| `mcp-status` | Show server status |
| `mcp-health` | Check server health |
| `mcp-logs` | View server logs |
| `mcp-port` | Check port usage |

### Database Operations

| Command | Description |
|---------|-------------|
| `mcp-reindex` | Clear cache and reindex |
| `mcp-clean-cache` | Clear embedding cache |

### Development Commands

| Command | Description |
|---------|-------------|
| `mcp-dev` | Start development server |
| `mcp-build` | Build TypeScript |
| `mcp-test` | Run tests |
| `mcp-lint` | Check code quality |

## 🔧 Advanced Usage

### Custom Indexing
```bash
# Index specific directory
cd /path/to/claude-code-rag-vector-db
npm run index-codebase -- --path /custom/path

# Index multiple projects
mcp-index  # from project A
cd /path/to/project-b
mcp-index  # from project B
```

### Performance Tuning
```bash
# Increase memory for large codebases
mcp-mem

# Debug mode
mcp-debug

# Watch mode for development
npm run dev
```

### Configuration

#### Server Settings
Edit `src/config/settings.ts`:
```typescript
export const config = {
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  vectorDb: {
    collection: 'codebase',
    similarity: 0.7
  },
  embedding: {
    model: 'Xenova/all-MiniLM-L6-v2',
    batchSize: 100
  }
};
```

#### File Type Support
Currently supports: `.ts`, `.js`, `.py`, `.java`, `.cpp`, `.h`, `.md`, `.txt`

## 🚨 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if port is in use
mcp-port

# Kill existing process
mcp-stop

# Check logs
mcp-logs
```

#### Indexing Problems
```bash
# Clear cache and reindex
mcp-reindex

# Check available memory
free -h

# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" mcp-start
```

#### Search Returns No Results
```bash
# Verify indexing completed
mcp-health

# Check if server is running
mcp-status

# Reindex current project
mcp-reindex
```

### Performance Considerations

#### Codebase Size Guidelines
- **<10MB**: Use grep/ripgrep instead (10x faster)
- **10-100MB**: Consider if semantic search is needed
- **100MB-1GB**: RAG starts showing benefits
- **>1GB**: RAG is significantly faster

#### Memory Requirements by Codebase Size
- **100MB**: ~2GB RAM
- **500MB**: ~4GB RAM  
- **1GB**: ~8GB RAM
- **5GB+**: ~16GB RAM

#### Slow Search
- Check server logs: `mcp-logs`
- Restart server: `mcp-restart`
- Clear cache: `mcp-clean-cache`

### Error Messages

| Error | Solution |
|-------|----------|
| `EADDRINUSE` | Port 3000 in use, run `mcp-stop` |
| `Module not found` | Run `npm install` |
| `Cannot connect to server` | Check server status with `mcp-status` |
| `Out of memory` | Use `mcp-mem` or increase Node heap size |

## 📊 Usage Examples

### For Web Development
```bash
cd /path/to/web-app
mcp-setup-project
mcp-search "API endpoints"
mcp-search "authentication"
mcp-search "database models"
```

### For AI/ML Projects
```bash
cd /path/to/ml-project
mcp-setup-project  
mcp-search "model training"
mcp-search "data preprocessing"
mcp-search "evaluation metrics"
```

### For System Administration
```bash
cd /path/to/scripts
mcp-setup-project
mcp-search "deployment scripts"
mcp-search "monitoring"
mcp-search "backup procedures"
```

## 🔍 How It Works

1. **Indexing**: Code files are parsed and split into semantic chunks
2. **Embedding**: Each chunk is converted to vector embeddings using transformers
3. **Storage**: Vectors are stored in ChromaDB for fast similarity search
4. **Retrieval**: When you search, similar vectors are found and ranked
5. **Integration**: Claude Code receives relevant context automatically

## 🎯 Best Practices

### Indexing Strategy
- Index project root directories
- Re-index after major code changes
- Use `mcp-reindex` for clean rebuilds

### Search Optimization
- Use specific terms rather than generic ones
- Combine multiple searches for complex queries
- Leverage natural language descriptions

### Server Management
- Keep server running during active development
- Restart server after configuration changes
- Monitor logs for performance issues

## 🔒 Security & Privacy

- **Local Only**: All processing happens locally
- **No External Calls**: No data sent to external APIs
- **File System Access**: Limited to specified directories
- **Memory Safe**: TypeScript with strict type checking

## 📈 Performance Metrics

### Indexing Performance
| Codebase Size | Indexing Time | Memory Usage |
|---------------|---------------|---------------|
| 10MB | ~30s | ~200MB |
| 100MB | ~3min | ~500MB |
| 1GB | ~15min | ~2GB |
| 10GB | ~2hr | ~8GB |

### Search Performance (after indexing)
| Codebase Size | Cold Search | Warm Search | vs grep |
|---------------|-------------|-------------|----------|
| <100MB | 10-20ms | 5-10ms | 5x slower |
| 100MB-1GB | 20-50ms | 10-20ms | 2x faster |
| 1-10GB | 50-200ms | 20-50ms | 10x faster |
| >10GB | 100-500ms | 30-100ms | 50x faster |

## 🛣️ Roadmap

- [ ] Support for more file types
- [ ] Incremental indexing
- [ ] Search result ranking improvements
- [ ] Web UI for search
- [ ] Integration with more editors
- [ ] Multi-language support

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Build the project: `npm run build`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Submit a pull request

### Development Setup
```bash
git clone https://github.com/typhoon1217/claude-code-rag-vector-db.git
cd claude-code-rag-vector-db
npm install
npm run build
npm run dev
```

## 📄 License

MIT License - see LICENSE file for details

---

For detailed implementation information, see [CLAUDE.md](./CLAUDE.md)