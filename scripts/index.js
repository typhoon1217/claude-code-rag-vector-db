#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../src/vector/client");
const codeProcessor_1 = require("../src/processors/codeProcessor");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
class IndexingCLI {
    constructor() {
        this.vectorStore = new client_1.VectorStore('./data/vector_store');
        this.codeProcessor = new codeProcessor_1.CodeProcessor();
    }
    async run() {
        const options = this.parseArgs();
        if (!options.path) {
            console.error('Usage: npm run index-codebase -- --path /path/to/codebase');
            process.exit(1);
        }
        try {
            await this.vectorStore.initialize();
            if (options.watch) {
                await this.watchMode(options);
            }
            else {
                await this.indexOnce(options);
            }
        }
        catch (error) {
            console.error('Indexing failed:', error);
            process.exit(1);
        }
    }
    async indexOnce(options) {
        const absolutePath = path.resolve(options.path);
        try {
            await fs.access(absolutePath);
        }
        catch (error) {
            throw new Error(`Directory does not exist: ${absolutePath}`);
        }
        console.log(`🔍 Starting indexing of: ${absolutePath}`);
        console.log(`📊 Force reindex: ${options.force ? 'Yes' : 'No'}`);
        const startTime = Date.now();
        const documents = await this.codeProcessor.processCodebase(absolutePath);
        if (documents.length === 0) {
            console.log('⚠️  No documents found to index');
            return;
        }
        console.log(`📄 Found ${documents.length} documents to index`);
        if (options.verbose) {
            this.printDocumentStats(documents);
        }
        await this.vectorStore.addDocuments(documents);
        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2);
        const totalCount = await this.vectorStore.getCount();
        console.log(`✅ Indexing complete!`);
        console.log(`   • Documents processed: ${documents.length}`);
        console.log(`   • Processing time: ${processingTime}s`);
        console.log(`   • Total in database: ${totalCount}`);
        console.log(`   • Average: ${(documents.length / parseFloat(processingTime)).toFixed(0)} docs/second`);
    }
    async watchMode(options) {
        const chokidar = await Promise.resolve().then(() => __importStar(require('chokidar')));
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
            }
            catch (error) {
                console.error(`Failed to index ${filePath}:`, error);
            }
        });
        watcher.on('add', async (filePath) => {
            console.log(`📄 File added: ${filePath}`);
            try {
                await this.indexFile(filePath, options.path);
            }
            catch (error) {
                console.error(`Failed to index ${filePath}:`, error);
            }
        });
        process.on('SIGINT', () => {
            console.log('🛑 Stopping watcher...');
            watcher.close();
            process.exit(0);
        });
    }
    async indexFile(filePath, rootPath) {
        try {
            const documents = await this.codeProcessor.processCodebase(rootPath);
            const relevantDocs = documents.filter(doc => doc.metadata.filepath === path.relative(rootPath, filePath));
            if (relevantDocs.length > 0) {
                await this.vectorStore.addDocuments(relevantDocs);
                console.log(`   ✅ Indexed ${relevantDocs.length} chunks from ${filePath}`);
            }
        }
        catch (error) {
            console.error(`Failed to index ${filePath}:`, error);
        }
    }
    printDocumentStats(documents) {
        const stats = {
            byType: {},
            byLanguage: {},
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
    parseArgs() {
        const args = process.argv.slice(2);
        const options = {
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
    printHelp() {
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
const cli = new IndexingCLI();
cli.run().catch(console.error);
//# sourceMappingURL=index.js.map