import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { Document } from '../vector/client';

export interface ProcessingOptions {
  maxChunkSize: number;
  overlapSize: number;
  includeComments: boolean;
  excludePatterns: string[];
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  maxChunkSize: 1000,
  overlapSize: 100,
  includeComments: true,
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ]
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.md': 'markdown',
  '.txt': 'text',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.sql': 'sql'
};

export class CodeProcessor {
  private options: ProcessingOptions;

  constructor(options: Partial<ProcessingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async processCodebase(rootPath: string): Promise<Document[]> {
    console.log(`Processing codebase at: ${rootPath}`);
    
    const files = await this.findFiles(rootPath);
    console.log(`Found ${files.length} files to process`);
    
    const documents: Document[] = [];
    
    for (const file of files) {
      try {
        const fileDocuments = await this.processFile(file, rootPath);
        documents.push(...fileDocuments);
      } catch (error) {
        console.warn(`Failed to process file ${file}:`, error);
      }
    }
    
    console.log(`Generated ${documents.length} document chunks`);
    return documents;
  }

  private async findFiles(rootPath: string): Promise<string[]> {
    const patterns = Object.keys(LANGUAGE_EXTENSIONS).map(ext => `**/*${ext}`);
    
    const files = await glob(patterns, {
      cwd: rootPath,
      absolute: true,
      ignore: this.options.excludePatterns
    });
    
    return files;
  }

  private async processFile(filePath: string, rootPath: string): Promise<Document[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(rootPath, filePath);
    const extension = path.extname(filePath);
    const language = LANGUAGE_EXTENSIONS[extension] || 'text';
    
    const documents: Document[] = [];
    
    if (language === 'markdown' || language === 'text') {
      // Process documentation files
      const chunks = this.chunkText(content);
      chunks.forEach((chunk, index) => {
        documents.push({
          id: `${relativePath}:doc:${index}`,
          content: chunk.content,
          metadata: {
            filepath: relativePath,
            type: 'doc',
            language,
            lines: chunk.lines
          }
        });
      });
    } else {
      // Process code files
      const codeChunks = this.chunkCode(content, relativePath, language);
      documents.push(...codeChunks);
    }
    
    return documents;
  }

  private chunkCode(content: string, filepath: string, language: string): Document[] {
    const documents: Document[] = [];
    
    // Extract functions and classes
    const structuralElements = this.extractStructuralElements(content, language);
    
    // Add structural elements as separate documents
    structuralElements.forEach(element => {
      documents.push({
        id: `${filepath}:${element.type}:${element.name}`,
        content: element.content,
        metadata: {
          filepath,
          type: 'code',
          language,
          lines: element.lines,
          [element.type]: element.name
        }
      });
    });
    
    // Chunk remaining code
    const chunks = this.chunkText(content);
    chunks.forEach((chunk, index) => {
      if (chunk.content.trim()) {
        documents.push({
          id: `${filepath}:chunk:${index}`,
          content: chunk.content,
          metadata: {
            filepath,
            type: 'code',
            language,
            lines: chunk.lines
          }
        });
      }
    });
    
    return documents;
  }

  private extractStructuralElements(content: string, language: string): Array<{
    type: 'function' | 'class';
    name: string;
    content: string;
    lines: { start: number; end: number };
  }> {
    const elements: Array<{
      type: 'function' | 'class';
      name: string;
      content: string;
      lines: { start: number; end: number };
    }> = [];
    
    const lines = content.split('\n');
    
    // Language-specific patterns
    const patterns = this.getLanguagePatterns(language);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for function definitions
      const functionMatch = line.match(patterns.function);
      if (functionMatch) {
        const functionName = functionMatch[1] || functionMatch[2] || 'anonymous';
        const functionContent = this.extractBlock(lines, i, language);
        
        elements.push({
          type: 'function',
          name: functionName,
          content: functionContent.content,
          lines: {
            start: i + 1,
            end: functionContent.endLine + 1
          }
        });
      }
      
      // Check for class definitions
      const classMatch = line.match(patterns.class);
      if (classMatch) {
        const className = classMatch[1];
        const classContent = this.extractBlock(lines, i, language);
        
        elements.push({
          type: 'class',
          name: className,
          content: classContent.content,
          lines: {
            start: i + 1,
            end: classContent.endLine + 1
          }
        });
      }
    }
    
    return elements;
  }

  private getLanguagePatterns(language: string): { function: RegExp; class: RegExp } {
    const patterns: Record<string, { function: RegExp; class: RegExp }> = {
      javascript: {
        function: /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\(.*?\)\s*=>)|\s*(\w+)\s*\(.*?\)\s*{)/,
        class: /class\s+(\w+)/
      },
      typescript: {
        function: /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\(.*?\)\s*=>)|\s*(\w+)\s*\(.*?\)\s*{)/,
        class: /class\s+(\w+)/
      },
      python: {
        function: /def\s+(\w+)/,
        class: /class\s+(\w+)/
      },
      java: {
        function: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/,
        class: /(?:public|private)?\s*class\s+(\w+)/
      },
      cpp: {
        function: /\w+\s+(\w+)\s*\(/,
        class: /class\s+(\w+)/
      }
    };
    
    return patterns[language] || patterns.javascript;
  }

  private extractBlock(lines: string[], startIndex: number, _language: string): { content: string; endLine: number } {
    const startLine = lines[startIndex];
    let braceCount = 0;
    let endIndex = startIndex;
    
    // Count opening braces in the start line
    for (const char of startLine) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    // Find matching closing brace
    for (let i = startIndex + 1; i < lines.length && braceCount > 0; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      endIndex = i;
    }
    
    const content = lines.slice(startIndex, endIndex + 1).join('\n');
    return { content, endLine: endIndex };
  }

  private chunkText(content: string): Array<{ content: string; lines: { start: number; end: number } }> {
    const lines = content.split('\n');
    const chunks: Array<{ content: string; lines: { start: number; end: number } }> = [];
    
    let currentChunk = '';
    let chunkStartLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (currentChunk.length + line.length > this.options.maxChunkSize) {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            lines: { start: chunkStartLine + 1, end: i }
          });
        }
        
        // Start new chunk with overlap
        const overlapStart = Math.max(0, i - Math.floor(this.options.overlapSize / 50));
        currentChunk = lines.slice(overlapStart, i + 1).join('\n');
        chunkStartLine = overlapStart;
      } else {
        if (currentChunk === '') {
          chunkStartLine = i;
        }
        currentChunk += line + '\n';
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        lines: { start: chunkStartLine + 1, end: lines.length }
      });
    }
    
    return chunks;
  }
}