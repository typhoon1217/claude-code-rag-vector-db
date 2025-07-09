import { ChromaClient, Collection } from 'chromadb';
import { pipeline } from '@xenova/transformers';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Document {
  id: string;
  content: string;
  metadata: {
    filepath: string;
    type: 'code' | 'doc' | 'comment';
    language?: string;
    lines?: { start: number; end: number };
    function?: string;
    class?: string;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Document['metadata'];
  score: number;
}

export class VectorStore {
  private client: ChromaClient;
  private collection!: Collection;
  private embedder!: any;
  private collectionName = 'codebase';
  private isInitialized = false;

  constructor(private dataPath: string = './data/vector_store') {
    this.client = new ChromaClient({
      path: this.dataPath
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing vector store...');
      
      // Initialize local embedding model
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true }
      ) as any;

      // Create or get collection
      try {
        this.collection = await this.client.getOrCreateCollection({
          name: this.collectionName,
          metadata: { description: 'Codebase embeddings for RAG' }
        });
        console.log('Collection ready');
      } catch (error) {
        console.error('Failed to create collection:', error);
        throw error;
      }

      this.isInitialized = true;
      console.log('Vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Convert tensor to array
      const embedding = Array.from(output.data) as number[];
      embeddings.push(embedding);
    }

    return embeddings;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized');
    }

    if (documents.length === 0) return;

    try {
      const contents = documents.map(doc => doc.content);
      const embeddings = await this.generateEmbeddings(contents);
      
      await this.collection.add({
        ids: documents.map(doc => doc.id),
        embeddings: embeddings,
        metadatas: documents.map(doc => ({
          filepath: doc.metadata.filepath,
          type: doc.metadata.type,
          language: doc.metadata.language || '',
          lines_start: doc.metadata.lines?.start || 0,
          lines_end: doc.metadata.lines?.end || 0,
          function: doc.metadata.function || '',
          class: doc.metadata.class || '',
          content: doc.content // Store content in metadata for retrieval
        })),
        documents: contents
      });

      console.log(`Added ${documents.length} documents to vector store`);
    } catch (error) {
      console.error('Failed to add documents:', error);
      throw error;
    }
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized');
    }

    try {
      const queryEmbedding = await this.generateEmbeddings([query]);
      
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding,
        nResults: limit,
        include: ['metadatas' as any, 'documents' as any, 'distances' as any]
      });

      if (!results.ids || !results.documents || !results.metadatas || !results.distances) {
        return [];
      }

      const searchResults: SearchResult[] = [];
      
      for (let i = 0; i < results.ids[0].length; i++) {
        const metadata = results.metadatas[0][i] as any;
        
        searchResults.push({
          id: results.ids[0][i] as string,
          content: results.documents[0][i] as string,
          metadata: {
            filepath: metadata.filepath,
            type: metadata.type,
            language: metadata.language,
            lines: metadata.lines_start > 0 ? {
              start: metadata.lines_start,
              end: metadata.lines_end
            } : undefined,
            function: metadata.function || undefined,
            class: metadata.class || undefined
          },
          score: 1 - (results.distances?.[0][i] || 0) // Convert distance to similarity
        });
      }

      return searchResults;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  async deleteCollection(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.client.deleteCollection({ name: this.collectionName });
      console.log('Collection deleted');
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  }

  async getCount(): Promise<number> {
    if (!this.isInitialized) return 0;

    try {
      const count = await this.collection.count();
      return count;
    } catch (error) {
      console.error('Failed to get count:', error);
      return 0;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await fs.rm(path.join(this.dataPath, 'cache'), { recursive: true, force: true });
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}