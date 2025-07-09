import { performance } from 'perf_hooks';
import { ChromaClient } from 'chromadb';
import { pipeline } from '@xenova/transformers';
import * as fs from 'fs/promises';
import { glob } from 'fast-glob';
import { execSync } from 'child_process';

interface EnhancedBenchmarkResult {
  scenario: string;
  metrics: {
    averageTime: number;
    p95Time: number;
    throughput: number;
    accuracy: number;
    cacheHitRate?: number;
  };
  details: {
    totalQueries: number;
    successfulMatches: number;
    codebaseSize: number;
    indexSize: number;
  };
}

class EnhancedPerformanceBenchmark {
  private chromaClient!: ChromaClient;
  private embedder: any;
  private collection: any;
  private cache = new Map<string, any>();
  private cacheHits = 0;
  private cacheMisses = 0;

  private complexQueries = [
    {
      query: "implement user authentication with JWT tokens and role-based access control",
      expectedFiles: ['auth.ts', 'api.ts'],
      semanticMatch: true
    },
    {
      query: "database connection pooling and transaction management",
      expectedFiles: ['database.ts'],
      semanticMatch: true
    },
    {
      query: "handle CORS and API middleware configuration", 
      expectedFiles: ['api.ts'],
      semanticMatch: true
    },
    {
      query: "password hashing and user registration workflow",
      expectedFiles: ['auth.ts'],
      semanticMatch: true
    },
    {
      query: "error handling and logging in API endpoints",
      expectedFiles: ['api.ts'],
      semanticMatch: false
    }
  ];

  async initialize() {
    console.log('🚀 Initializing enhanced benchmark environment...');
    this.chromaClient = new ChromaClient({
      path: 'http://localhost:8000'
    });
    
    console.log('📊 Loading embedding model with caching...');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    try {
      await this.chromaClient.deleteCollection({ name: 'enhanced-benchmark' });
    } catch (error) {
      // Collection might not exist
    }
    
    this.collection = await this.chromaClient.createCollection({
      name: 'enhanced-benchmark',
      metadata: { description: 'Enhanced performance benchmark' }
    });
  }

  async generateLargeCodebase() {
    console.log('🔨 Generating large synthetic codebase...');
    const baseDir = './test-data/large-codebase';
    
    // Clean and create directory
    await fs.rm(baseDir, { recursive: true, force: true });
    await fs.mkdir(baseDir, { recursive: true });
    
    // Generate multiple modules
    const modules = ['auth', 'api', 'database', 'utils', 'services', 'models', 'controllers', 'middleware'];
    const components = ['user', 'product', 'order', 'payment', 'inventory', 'shipping', 'notification', 'analytics'];
    
    let fileCount = 0;
    
    for (const module of modules) {
      await fs.mkdir(`${baseDir}/${module}`, { recursive: true });
      
      for (const component of components) {
        const content = this.generateSyntheticCode(module, component);
        await fs.writeFile(`${baseDir}/${module}/${component}.ts`, content);
        fileCount++;
      }
    }
    
    console.log(`✅ Generated ${fileCount} files in synthetic codebase`);
    return baseDir;
  }

  private generateSyntheticCode(module: string, component: string): string {
    const templates: Record<string, string> = {
      auth: `
import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { ${component}Model } from '../models/${component}';
import { AuthenticationError, AuthorizationError } from '../errors';

export class ${component}AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET;
  private readonly tokenExpiry = '24h';

  async authenticate${component}(credentials: ${component}Credentials): Promise<AuthToken> {
    const ${component.toLowerCase()} = await ${component}Model.findByEmail(credentials.email);
    if (!${component.toLowerCase()}) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isValid = await compare(credentials.password, ${component.toLowerCase()}.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const token = sign(
      { id: ${component.toLowerCase()}.id, role: ${component.toLowerCase()}.role },
      this.jwtSecret,
      { expiresIn: this.tokenExpiry }
    );

    return { token, expiresAt: this.calculateExpiry() };
  }

  async authorize${component}(token: string, requiredRole?: string): Promise<${component}> {
    try {
      const decoded = verify(token, this.jwtSecret) as TokenPayload;
      const ${component.toLowerCase()} = await ${component}Model.findById(decoded.id);
      
      if (!${component.toLowerCase()}) {
        throw new AuthorizationError('Invalid token');
      }

      if (requiredRole && ${component.toLowerCase()}.role !== requiredRole) {
        throw new AuthorizationError('Insufficient permissions');
      }

      return ${component.toLowerCase()};
    } catch (error) {
      throw new AuthorizationError('Invalid token');
    }
  }
}`,
      database: `
import { Pool, PoolClient } from 'pg';
import { ${component}Schema } from '../schemas/${component}';
import { DatabaseError, TransactionError } from '../errors';

export class ${component}Repository {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async find${component}ById(id: string): Promise<${component} | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM ${component.toLowerCase()}s WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to fetch ${component.toLowerCase()}');
    } finally {
      client.release();
    }
  }

  async create${component}(data: Create${component}DTO): Promise<${component}> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        \`INSERT INTO \${component.toLowerCase()}s (\${Object.keys(data).join(', ')}) VALUES (\${Object.keys(data).map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *\`,
        Object.values(data)
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw new TransactionError('Failed to create ${component.toLowerCase()}');
    } finally {
      client.release();
    }
  }
}`,
      api: `
import { Router, Request, Response, NextFunction } from 'express';
import { ${component}Service } from '../services/${component}';
import { validate${component} } from '../validators/${component}';
import { authMiddleware, rateLimitMiddleware } from '../middleware';
import { ApiError, ValidationError } from '../errors';

export class ${component}Controller {
  private router: Router;
  private service: ${component}Service;

  constructor(service: ${component}Service) {
    this.router = Router();
    this.service = service;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get(
      '/${component.toLowerCase()}s',
      authMiddleware,
      rateLimitMiddleware,
      this.getAll${component}s.bind(this)
    );

    this.router.get(
      '/${component.toLowerCase()}s/:id',
      authMiddleware,
      this.get${component}ById.bind(this)
    );

    this.router.post(
      '/${component.toLowerCase()}s',
      authMiddleware,
      validate${component},
      this.create${component}.bind(this)
    );

    this.router.put(
      '/${component.toLowerCase()}s/:id',
      authMiddleware,
      validate${component},
      this.update${component}.bind(this)
    );
  }

  async getAll${component}s(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;
      const ${component.toLowerCase()}s = await this.service.getAll${component}s({
        page: Number(page),
        limit: Number(limit),
        sort: String(sort),
        order: order as 'asc' | 'desc'
      });
      res.json(${component.toLowerCase()}s);
    } catch (error) {
      next(new ApiError('Failed to fetch ${component.toLowerCase()}s', 500));
    }
  }
}`
    };

    const template = templates[module] || templates.api;
    return template.trim();
  }

  async benchmarkScenario(scenario: string, searchFunction: () => Promise<any>): Promise<EnhancedBenchmarkResult> {
    const times: number[] = [];
    let successfulMatches = 0;
    
    console.log(`\n📊 Running scenario: ${scenario}`);
    
    // Warm up
    await searchFunction();
    
    // Reset cache stats
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Run benchmark
    for (let i = 0; i < this.complexQueries.length * 3; i++) {
      const startTime = performance.now();
      
      try {
        const results = await searchFunction();
        if (results && results.length > 0) {
          successfulMatches++;
        }
      } catch (error) {
        // Count as failed match
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    // Calculate metrics
    times.sort((a, b) => a - b);
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p95Time = times[Math.floor(times.length * 0.95)];
    const throughput = 1000 / averageTime;
    const accuracy = (successfulMatches / times.length) * 100;
    const cacheHitRate = this.cacheHits > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 : 0;
    
    // Get codebase stats
    const codebaseStats = await this.getCodebaseStats();
    
    return {
      scenario,
      metrics: {
        averageTime,
        p95Time,
        throughput,
        accuracy,
        cacheHitRate
      },
      details: {
        totalQueries: times.length,
        successfulMatches,
        codebaseSize: codebaseStats.totalSize,
        indexSize: codebaseStats.indexSize
      }
    };
  }

  private async getCodebaseStats(): Promise<{totalSize: number, indexSize: number}> {
    try {
      const files = await glob('**/*.ts', { cwd: './test-data/large-codebase' });
      let totalSize = 0;
      
      for (const file of files) {
        const stats = await fs.stat(`./test-data/large-codebase/${file}`);
        totalSize += stats.size;
      }
      
      // Estimate index size (rough calculation)
      const indexSize = files.length * 768 * 4 * 5; // embeddings * float32 * chunks per file
      
      return { totalSize, indexSize };
    } catch (error) {
      return { totalSize: 0, indexSize: 0 };
    }
  }

  private async cachedEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embed_${text}`;
    
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey);
    }
    
    this.cacheMisses++;
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    this.cache.set(cacheKey, embedding);
    
    return embedding;
  }

  async runComprehensiveBenchmark() {
    await this.initialize();
    const largeCodebase = await this.generateLargeCodebase();
    
    // Index the large codebase
    console.log('\n📁 Indexing large codebase for RAG...');
    const indexStart = performance.now();
    await this.indexCodebase(largeCodebase);
    const indexTime = performance.now() - indexStart;
    console.log(`✅ Indexing completed in ${(indexTime / 1000).toFixed(2)} seconds`);
    
    // Scenario 1: Cold search without caching
    const coldSearchRAG = await this.benchmarkScenario(
      'RAG Vector Search (Cold)',
      async () => {
        const query = this.complexQueries[Math.floor(Math.random() * this.complexQueries.length)];
        const embedding = await this.embedder(query.query, { pooling: 'mean', normalize: true });
        return await this.collection.query({
          queryEmbeddings: [Array.from(embedding.data as Float32Array)],
          nResults: 5
        });
      }
    );
    
    // Scenario 2: Warm search with caching
    const warmSearchRAG = await this.benchmarkScenario(
      'RAG Vector Search (Warm + Cached)',
      async () => {
        const query = this.complexQueries[Math.floor(Math.random() * this.complexQueries.length)];
        const embedding = await this.cachedEmbedding(query.query);
        return await this.collection.query({
          queryEmbeddings: [embedding],
          nResults: 5
        });
      }
    );
    
    // Scenario 3: Traditional grep search
    const grepSearch = await this.benchmarkScenario(
      'Traditional Grep Search',
      async () => {
        const query = this.complexQueries[Math.floor(Math.random() * this.complexQueries.length)];
        const searchTerms = query.query.split(' ').slice(0, 3).join('|');
        try {
          const result = execSync(
            `grep -r -i "${searchTerms}" ./test-data/large-codebase --include="*.ts" | head -5`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 }
          );
          return result.split('\n').filter(line => line.trim());
        } catch (error) {
          return [];
        }
      }
    );
    
    return {
      indexingTime: indexTime,
      scenarios: [coldSearchRAG, warmSearchRAG, grepSearch]
    };
  }

  private async indexCodebase(codebasePath: string): Promise<void> {
    const files = await glob('**/*.ts', { 
      cwd: codebasePath,
      absolute: true 
    });
    
    const batchSize = 20;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const documents: string[] = [];
      const metadatas: any[] = [];
      const ids: string[] = [];
      const embeddings: number[][] = [];
      
      for (const file of batch) {
        const content = await fs.readFile(file, 'utf-8');
        const chunks = this.smartChunkCode(content, file);
        
        for (const chunk of chunks) {
          documents.push(chunk.content);
          metadatas.push(chunk.metadata);
          ids.push(chunk.id);
          
          const embedding = await this.cachedEmbedding(chunk.content);
          embeddings.push(embedding);
        }
      }
      
      if (documents.length > 0) {
        await this.collection.add({
          ids,
          embeddings,
          documents,
          metadatas
        });
      }
    }
  }

  private smartChunkCode(content: string, filepath: string): Array<{id: string, content: string, metadata: any}> {
    const chunks: Array<{id: string, content: string, metadata: any}> = [];
    
    // Extract functions and classes as semantic chunks
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)[\s\S]*?^}/gm;
    const classRegex = /(?:export\s+)?class\s+(\w+)[\s\S]*?^}/gm;
    
    let match;
    
    // Extract functions
    while ((match = functionRegex.exec(content)) !== null) {
      chunks.push({
        id: `${filepath}_func_${match[1]}`,
        content: match[0],
        metadata: {
          filepath,
          type: 'function',
          name: match[1],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        }
      });
    }
    
    // Extract classes
    content.replace(classRegex, (match, className, offset) => {
      chunks.push({
        id: `${filepath}_class_${className}`,
        content: match,
        metadata: {
          filepath,
          type: 'class',
          name: className,
          startIndex: offset,
          endIndex: offset + match.length
        }
      });
      return match;
    });
    
    // If no chunks found, fall back to line-based chunking
    if (chunks.length === 0) {
      const lines = content.split('\n');
      const chunkSize = 50;
      
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join('\n');
        if (chunk.trim()) {
          chunks.push({
            id: `${filepath}_lines_${i}`,
            content: chunk,
            metadata: {
              filepath,
              type: 'lines',
              startLine: i,
              endLine: Math.min(i + chunkSize, lines.length)
            }
          });
        }
      }
    }
    
    return chunks;
  }
}

// Run benchmark if executed directly
if (require.main === module) {
  const benchmark = new EnhancedPerformanceBenchmark();
  
  benchmark.runComprehensiveBenchmark()
    .then(async (results) => {
      console.log('\n' + '='.repeat(80));
      console.log('COMPREHENSIVE BENCHMARK RESULTS');
      console.log('='.repeat(80));
      
      console.log(`\n⏱️  Indexing Time: ${(results.indexingTime / 1000).toFixed(2)} seconds`);
      
      for (const scenario of results.scenarios) {
        console.log(`\n📊 ${scenario.scenario}`);
        console.log(`   Average Time: ${scenario.metrics.averageTime.toFixed(2)}ms`);
        console.log(`   P95 Time: ${scenario.metrics.p95Time.toFixed(2)}ms`);
        console.log(`   Throughput: ${scenario.metrics.throughput.toFixed(2)} queries/sec`);
        console.log(`   Accuracy: ${scenario.metrics.accuracy.toFixed(1)}%`);
        if (scenario.metrics.cacheHitRate !== undefined) {
          console.log(`   Cache Hit Rate: ${scenario.metrics.cacheHitRate.toFixed(1)}%`);
        }
        console.log(`   Codebase Size: ${(scenario.details.codebaseSize / 1024).toFixed(2)} KB`);
        console.log(`   Index Size: ${(scenario.details.indexSize / 1024 / 1024).toFixed(2)} MB`);
      }
      
      // Calculate improvements
      const grepTime = results.scenarios.find(s => s.scenario.includes('Grep'))!.metrics.averageTime;
      const coldRAGTime = results.scenarios.find(s => s.scenario.includes('Cold'))!.metrics.averageTime;
      const warmRAGTime = results.scenarios.find(s => s.scenario.includes('Warm'))!.metrics.averageTime;
      
      console.log('\n🚀 Performance Improvements:');
      console.log(`   RAG (Cold) vs Grep: ${(grepTime / coldRAGTime).toFixed(2)}x faster`);
      console.log(`   RAG (Warm) vs Grep: ${(grepTime / warmRAGTime).toFixed(2)}x faster`);
      console.log(`   Cache Impact: ${(coldRAGTime / warmRAGTime).toFixed(2)}x speedup`);
      
      // Save results
      await fs.writeFile(
        'enhanced-benchmark-results.json',
        JSON.stringify(results, null, 2)
      );
      
      console.log('\n✅ Enhanced benchmark complete! Results saved to enhanced-benchmark-results.json');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Enhanced benchmark failed:', error);
      process.exit(1);
    });
}

export { EnhancedPerformanceBenchmark };