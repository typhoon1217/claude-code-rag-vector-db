#!/usr/bin/env ts-node

import { VectorStore } from '../src/vector/client';
import { CodeProcessor } from '../src/processors/codeProcessor';
import * as path from 'path';
import * as fs from 'fs/promises';

interface IndexOptions {
  path: string;
  force?: boolean;
  watch?: boolean;
  verbose?: boolean;
}

class IndexingCLI {
  private vectorStore: VectorStore;
  private codeProcessor: CodeProcessor;

  constructor() {
    this.vectorStore = new VectorStore('./data/vector_store');
    this.codeProcessor = new CodeProcessor();
  }

  async run(): Promise<void> {
    const options = this.parseArgs();
    
    if (!options.path) {
      console.error('Usage: npm run index-codebase -- --path /path/to/codebase');
      process.exit(1);
    }

    try {
      await this.vectorStore.initialize();
      
      if (options.watch) {
        await this.watchMode(options);
      } else {
        await this.indexOnce(options);
      }
    } catch (error) {
      console.error('Indexing failed:', error);
      process.exit(1);
    }
  }

  private async indexOnce(options: IndexOptions): Promise<void> {
    const absolutePath = path.resolve(options.path);
    
    // Verify path exists
    try {
      await fs.access(absolutePath);
    } catch (error) {
      throw new Error(`Directory does not exist: ${absolutePath}`);
    }

    console.log(`🔍 Starting indexing of: ${absolutePath}`);
    console.log(`📊 Force reindex: ${options.force ? 'Yes' : 'No'}`);
    
    const startTime = Date.now();
    
    // Process the codebase
    const documents = await this.codeProcessor.processCodebase(absolutePath);
    
    if (documents.length === 0) {
      console.log('⚠️  No documents found to index');
      return;
    }

    console.log(`📄 Found ${documents.length} documents to index`);
    
    if (options.verbose) {
      this.printDocumentStats(documents);
    }

    // Add to vector store
    await this.vectorStore.addDocuments(documents);
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    // Get final stats
    const totalCount = await this.vectorStore.getCount();
    
    console.log(`✅ Indexing complete!`);
    console.log(`   • Documents processed: ${documents.length}`);
    console.log(`   • Processing time: ${processingTime}s`);
    console.log(`   • Total in database: ${totalCount}`);
    console.log(`   • Average: ${(documents.length / parseFloat(processingTime)).toFixed(0)} docs/second`);
  }

  private async watchMode(options: IndexOptions): Promise<void> {
    const chokidar = await import('chokidar');
    
    console.log(`👀 Watching for changes in: ${options.path}`);
    
    const watcher = chokidar.watch(options.path, {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ],
      persistent: true,
      ignoreInitial: false
    });

    watcher.on('change', async (filePath) => {
      console.log(`📝 File changed: ${filePath}`);
      try {
        await this.indexFile(filePath, options.path);
      } catch (error) {
        console.error(`Failed to index ${filePath}:`, error);
      }
    });

    watcher.on('add', async (filePath) => {
      console.log(`📄 File added: ${filePath}`);
      try {
        await this.indexFile(filePath, options.path);
      } catch (error) {
        console.error(`Failed to index ${filePath}:`, error);
      }
    });

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('🛑 Stopping watcher...');
      watcher.close();
      process.exit(0);
    });
  }

  private async indexFile(filePath: string, rootPath: string): Promise<void> {
    try {
      const documents = await this.codeProcessor.processCodebase(rootPath);
      const relevantDocs = documents.filter(doc => 
        doc.metadata.filepath === path.relative(rootPath, filePath)
      );
      
      if (relevantDocs.length > 0) {
        await this.vectorStore.addDocuments(relevantDocs);
        console.log(`   ✅ Indexed ${relevantDocs.length} chunks from ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to index ${filePath}:`, error);
    }
  }

  private printDocumentStats(documents: any[]): void {
    const stats = {
      byType: {} as Record<string, number>,
      byLanguage: {} as Record<string, number>,
      totalChars: 0
    };

    documents.forEach(doc => {
      stats.byType[doc.metadata.type] = (stats.byType[doc.metadata.type] || 0) + 1;
      if (doc.metadata.language) {
        stats.byLanguage[doc.metadata.language] = (stats.byLanguage[doc.metadata.language] || 0) + 1;
      }
      stats.totalChars += doc.content.length;
    });

    console.log(`📊 Document Statistics:`);
    console.log(`   Types:`, stats.byType);
    console.log(`   Languages:`, stats.byLanguage);
    console.log(`   Average size: ${(stats.totalChars / documents.length).toFixed(0)} characters`);
  }

  private parseArgs(): IndexOptions {
    const args = process.argv.slice(2);
    const options: IndexOptions = {
      path: '',
      force: false,
      watch: false,
      verbose: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--path':
          options.path = args[++i];
          break;
        case '--force':
          options.force = true;
          break;
        case '--watch':
          options.watch = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--help':
        case '-h':
          this.printHelp();
          process.exit(0);
      }
    }

    return options;
  }

  private printHelp(): void {
    console.log(`
Claude Code RAG Indexing Tool

Usage:
  npm run index-codebase -- --path /path/to/codebase [options]

Options:
  --path PATH     Path to the codebase directory to index (required)
  --force         Force reindexing even if already indexed
  --watch         Watch for file changes and reindex automatically
  --verbose, -v   Show detailed statistics
  --help, -h      Show this help message

Examples:
  npm run index-codebase -- --path ./my-project
  npm run index-codebase -- --path /home/user/projects/web-app --verbose
  npm run index-codebase -- --path ./src --watch
`);
  }
}

// Run the CLI
const cli = new IndexingCLI();
cli.run().catch(console.error);