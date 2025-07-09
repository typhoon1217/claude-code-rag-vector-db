import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  Tool,
  TextContent,
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import { VectorStore } from '../vector/client.js';
import { CodeProcessor } from '../processors/codeProcessor.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export class RAGServer {
  private server: Server;
  private vectorStore: VectorStore;
  private codeProcessor: CodeProcessor;
  private isReady = false;

  constructor() {
    this.server = new Server({
      name: 'rag-context',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.vectorStore = new VectorStore('./data/vector_store');
    this.codeProcessor = new CodeProcessor();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
      const tools: Tool[] = [
        {
          name: 'search_codebase',
          description: 'Search through the indexed codebase for relevant code snippets and documentation',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query to find relevant code or documentation'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 5,
                minimum: 1,
                maximum: 20
              }
            },
            required: ['query']
          }
        },
        {
          name: 'index_codebase',
          description: 'Index a codebase directory for semantic search',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the codebase directory to index'
              },
              force: {
                type: 'boolean',
                description: 'Force reindexing even if already indexed',
                default: false
              }
            },
            required: ['path']
          }
        },
        {
          name: 'get_index_stats',
          description: 'Get statistics about the current vector database index',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        {
          name: 'clear_index',
          description: 'Clear the entire vector database index',
          inputSchema: {
            type: 'object',
            properties: {
              confirm: {
                type: 'boolean',
                description: 'Confirmation to clear the index',
                default: false
              }
            },
            required: ['confirm']
          }
        }
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_codebase':
            return await this.handleSearchCodebase(args);
          case 'index_codebase':
            return await this.handleIndexCodebase(args);
          case 'get_index_stats':
            return await this.handleGetIndexStats();
          case 'clear_index':
            return await this.handleClearIndex(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`
            } as TextContent
          ]
        };
      }
    });
  }

  private async handleSearchCodebase(args: any): Promise<CallToolResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    const { query, limit = 5 } = args;

    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }

    const results = await this.vectorStore.search(query, Math.min(limit, 20));

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No results found for your query. Try different search terms or make sure the codebase is indexed.'
          } as TextContent
        ]
      };
    }

    const formattedResults = results.map((result, index) => {
      const { metadata, content, score } = result;
      const lines = metadata.lines ? `:${metadata.lines.start}-${metadata.lines.end}` : '';
      
      return `## Result ${index + 1} (Score: ${score.toFixed(3)})
**File:** ${metadata.filepath}${lines}
**Type:** ${metadata.type}${metadata.language ? ` (${metadata.language})` : ''}
${metadata.function ? `**Function:** ${metadata.function}` : ''}
${metadata.class ? `**Class:** ${metadata.class}` : ''}

\`\`\`${metadata.language || 'text'}
${content}
\`\`\``;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} relevant results:\n\n${formattedResults}`
        } as TextContent
      ]
    };
  }

  private async handleIndexCodebase(args: any): Promise<CallToolResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    const { path: codePath } = args;

    if (!codePath || typeof codePath !== 'string') {
      throw new Error('Path parameter is required and must be a string');
    }

    const absolutePath = path.resolve(codePath);

    try {
      await fs.access(absolutePath);
    } catch (error) {
      throw new Error(`Directory does not exist: ${absolutePath}`);
    }

    console.log(`Starting indexing of: ${absolutePath}`);
    
    const startTime = Date.now();
    const documents = await this.codeProcessor.processCodebase(absolutePath);
    
    if (documents.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No documents found to index in: ${absolutePath}`
          } as TextContent
        ]
      };
    }

    await this.vectorStore.addDocuments(documents);
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);

    const stats = await this.vectorStore.getCount();

    return {
      content: [
        {
          type: 'text',
          text: `Successfully indexed ${documents.length} documents from ${absolutePath}\nProcessing time: ${processingTime}s\nTotal documents in index: ${stats}`
        } as TextContent
      ]
    };
  }

  private async handleGetIndexStats(): Promise<CallToolResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    const count = await this.vectorStore.getCount();

    return {
      content: [
        {
          type: 'text',
          text: `Vector Database Statistics:
- Total documents: ${count}
- Collection: codebase
- Status: ${this.isReady ? 'Ready' : 'Initializing'}
- Storage: ./data/vector_store`
        } as TextContent
      ]
    };
  }

  private async handleClearIndex(args: any): Promise<CallToolResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    const { confirm = false } = args;

    if (!confirm) {
      return {
        content: [
          {
            type: 'text',
            text: 'Index clearing cancelled. Set confirm=true to proceed.'
          } as TextContent
        ]
      };
    }

    await this.vectorStore.deleteCollection();
    await this.vectorStore.clearCache();

    return {
      content: [
        {
          type: 'text',
          text: 'Vector database index cleared successfully.'
        } as TextContent
      ]
    };
  }

  async initialize(): Promise<void> {
    if (this.isReady) return;

    try {
      console.log('Initializing RAG server...');
      await this.vectorStore.initialize();
      this.isReady = true;
      console.log('RAG server ready');
    } catch (error) {
      console.error('Failed to initialize RAG server:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    console.log('Starting MCP RAG server...');
    
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('MCP RAG server started successfully');
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new RAGServer();
  server.start().catch(console.error);
}