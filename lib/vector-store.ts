/**
 * Unified Vector Store Abstraction Layer
 * 
 * Provides a single interface for vector database operations with support for:
 * - Chroma (local/remote)
 * - Supabase pgvector (cloud PostgreSQL)
 * - MySQL FULLTEXT (fallback, no true vectors)
 * 
 * Switch between providers using VECTOR_DB_TYPE env variable:
 * - "chroma" (default if Chroma configured)
 * - "supabase" (default if Supabase configured)
 * - "mysql" (always available as fallback)
 */

import { getEmbeddingModelId, getEmbeddingProvider } from './openai';

// ============================================
// Types
// ============================================

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;   // 0-1, higher is better (normalized from distance)
  distance?: number;     // raw distance from vector DB
}

export interface DocumentInput {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface VectorStoreConfig {
  type: 'chroma' | 'supabase' | 'mysql' | 'hybrid';
  name: string;
  enabled: boolean;
  description: string;
}

// ============================================
// Provider Interface
// ============================================

export interface VectorStoreProvider {
  /** Provider type identifier */
  readonly type: 'chroma' | 'supabase' | 'mysql' | 'hybrid';

  /** Provider display name */
  readonly name: string;

  /** Initialize the provider (e.g., create tables, connect) */
  initialize(): Promise<void>;

  /** Check if provider is available/healthy */
  isAvailable(): Promise<boolean>;

  /** Add documents to the vector store */
  addDocuments(documents: DocumentInput[]): Promise<void>;

  /** Query similar documents */
  query(query: string, topK?: number, threshold?: number): Promise<VectorDocument[]>;

  /** Get all documents in the store (used for BM25 index building) */
  getAllDocuments?(): Promise<VectorDocument[]>;

  /** Delete all documents */
  clear(): Promise<void>;

  /** Get document count */
  count(): Promise<number>;

  /** Delete specific documents by IDs */
  deleteDocuments(ids: string[]): Promise<void>;
}

// ============================================
// Environment Detection
// ============================================

/**
 * Detect which vector store provider to use based on environment variables
 */
export function detectVectorStoreType(): 'chroma' | 'supabase' | 'mysql' | 'hybrid' {
  const type = process.env.VECTOR_DB_TYPE?.toLowerCase();

  if (type === 'chroma' || type === 'supabase' || type === 'mysql' || type === 'hybrid') {
    return type;
  }

  // Auto-detect based on what's configured
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_KEY?.trim();
  const hasSupabase = supabaseUrl && supabaseUrl.startsWith('https://') && supabaseKey;

  const chromaDir = process.env.CHROMA_PERSIST_DIR?.trim();
  const hasChroma = !!chromaDir;

  // Priority: hybrid > supabase > chroma > mysql
  // When HYBRID_ENABLED=true, use hybrid retrieval (BM25 + kNN)
  const hybridEnabled = process.env.HYBRID_ENABLED === 'true';
  if (hybridEnabled && (hasSupabase || hasChroma)) return 'hybrid';
  if (hasSupabase) return 'supabase';
  if (hasChroma) return 'chroma';
  return 'mysql';
}

/**
 * Get all available providers with their status
 */
export async function getAvailableProviders(): Promise<VectorStoreConfig[]> {
  const configs: VectorStoreConfig[] = [
    {
      type: 'chroma',
      name: 'Chroma',
      enabled: detectVectorStoreType() === 'chroma',
      description: 'Open-source embedding database. Local or remote server.'
    },
    {
      type: 'supabase',
      name: 'Supabase pgvector',
      enabled: detectVectorStoreType() === 'supabase',
      description: 'Cloud PostgreSQL with pgvector extension. True semantic search.'
    },
    {
      type: 'mysql',
      name: 'MySQL FULLTEXT',
      enabled: detectVectorStoreType() === 'mysql',
      description: 'MySQL FULLTEXT search. Fallback option, keyword-based.'
    },
    {
      type: 'hybrid',
      name: 'Hybrid (BM25 + kNN)',
      enabled: detectVectorStoreType() === 'hybrid',
      description: 'Hybrid retrieval: BM25 keyword search + kNN vector search, fused via RRF, reranked.'
    }
  ];
  
  // Check actual availability
  for (const config of configs) {
    const provider = getProviderByType(config.type);
    if (provider) {
      config.enabled = await provider.isAvailable().catch(() => false);
    }
  }
  
  return configs;
}

/**
 * Get provider instance by type
 */
export function getProviderByType(type: 'chroma' | 'supabase' | 'mysql' | 'hybrid'): VectorStoreProvider | null {
  switch (type) {
    case 'chroma':
      return getChromaProvider();
    case 'supabase':
      return getSupabaseProvider();
    case 'mysql':
      return getMySQLProvider();
    case 'hybrid':
      return null; // Hybrid is handled separately via HybridRetriever
    default:
      return null;
  }
}

// ============================================
// Lazy-loaded Providers
// ============================================

let chromaProvider: VectorStoreProvider | null = null;
let supabaseProvider: VectorStoreProvider | null = null;
let mysqlProvider: VectorStoreProvider | null = null;

/**
 * Get or create the Chroma provider
 */
function getChromaProvider(): VectorStoreProvider {
  if (!chromaProvider) {
    const { ChromaVectorStore } = require('./providers/chroma');
    chromaProvider = new ChromaVectorStore();
  }
  return chromaProvider as VectorStoreProvider;
}

/**
 * Get or create the Supabase pgvector provider
 */
function getSupabaseProvider(): VectorStoreProvider {
  if (!supabaseProvider) {
    const { SupabaseVectorStore } = require('./providers/supabase-pgvector');
    supabaseProvider = new SupabaseVectorStore();
  }
  return supabaseProvider as VectorStoreProvider;
}

/**
 * Get or create the MySQL FULLTEXT provider
 */
function getMySQLProvider(): VectorStoreProvider {
  if (!mysqlProvider) {
    const { MySQLVectorStore } = require('./providers/mysql-fulltext');
    mysqlProvider = new MySQLVectorStore();
  }
  return mysqlProvider as VectorStoreProvider;
}

// ============================================
// Main Vector Store API
// ============================================

let currentProvider: VectorStoreProvider | null = null;

/**
 * Get the current active vector store provider
 */
export function getVectorStore(): VectorStoreProvider {
  if (!currentProvider) {
    const type = detectVectorStoreType();

    switch (type) {
      case 'chroma':
        currentProvider = getChromaProvider();
        console.log(`[VectorStore] Using Chroma provider`);
        break;
      case 'supabase':
        currentProvider = getSupabaseProvider();
        console.log(`[VectorStore] Using Supabase pgvector provider`);
        break;
      case 'mysql':
        currentProvider = getMySQLProvider();
        console.log(`[VectorStore] Using MySQL FULLTEXT provider`);
        break;
      case 'hybrid':
        // Hybrid is handled by HybridRetriever, not a VectorStoreProvider
        // Return the base kNN provider (supabase/chroma) for raw queries
        const baseType = process.env.SUPABASE_URL ? 'supabase' : 'chroma';
        currentProvider = baseType === 'supabase' ? getSupabaseProvider() : getChromaProvider();
        console.log(`[VectorStore] Using Hybrid retrieval (BM25 + kNN)`);
        break;
      default:
        currentProvider = getMySQLProvider();
        console.log(`[VectorStore] Using MySQL FULLTEXT provider`);
        break;
    }
  }

  return currentProvider;
}

/**
 * Switch to a different provider at runtime
 */
export function switchVectorStore(type: 'chroma' | 'supabase' | 'mysql'): void {
  currentProvider = getProviderByType(type)!;
  console.log(`[VectorStore] Switched to ${type} provider`);
}

/**
 * Generate a unique document ID
 */
export function generateDocId(url: string, index: number): string {
  const hash = url.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${Math.abs(hash)}_${index}_${Date.now()}`;
}

// ============================================
// Convenience Functions (delegates to current provider)
// ============================================

/**
 * Add documents to the vector store
 */
export async function addDocuments(documents: DocumentInput[]): Promise<void> {
  const provider = getVectorStore();
  
  // Generate embeddings and add documents
  const embedClient = getEmbeddingProvider();
  const { embed } = await import('ai');
  const modelId = getEmbeddingModelId();
  
  for (const doc of documents) {
    const result = await embed({
      model: embedClient.embedding(modelId),
      value: doc.content
    });
    
    // Provider handles embedding storage
    await provider.addDocuments([{
      ...doc,
      metadata: {
        ...doc.metadata,
        embedding: result.embedding
      }
    }]);
  }
}

/**
 * Query similar documents from the vector store
 * Automatically uses HybridRetriever when HYBRID_ENABLED=true
 */
export async function querySimilarDocuments(
  query: string,
  topK: number = 5,
  threshold: number = 0.3
): Promise<VectorDocument[]> {
  const type = detectVectorStoreType();

  // Route to hybrid retrieval when enabled
  if (type === 'hybrid') {
    const { hybridSearch } = await import('./hybrid-retrieval');
    const results = await hybridSearch(query, { knnTopK: topK, knnThreshold: threshold, topK });
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      similarity: r.fusionScore,
    }));
  }

  const provider = getVectorStore();
  return provider.query(query, topK, threshold);
}

/**
 * Clear all documents from the vector store
 */
export async function clearCollection(): Promise<void> {
  const provider = getVectorStore();
  return provider.clear();
}

/**
 * Get document count
 */
export async function getCollectionCount(): Promise<number> {
  const provider = getVectorStore();
  return provider.count();
}

/**
 * Delete specific documents
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  const provider = getVectorStore();
  return provider.deleteDocuments(ids);
}

/**
 * Check if vector store is available
 */
export async function isVectorStoreAvailable(): Promise<boolean> {
  try {
    const provider = getVectorStore();
    return provider.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Get current provider info
 */
export function getCurrentProviderInfo(): { type: string; name: string } {
  const type = detectVectorStoreType();
  const names: Record<string, string> = {
    chroma: 'Chroma',
    supabase: 'Supabase pgvector',
    mysql: 'MySQL FULLTEXT',
    hybrid: 'Hybrid (BM25 + kNN + RRF + Rerank)'
  };
  return { type, name: names[type] ?? 'Unknown' };
}

/**
 * Initialize the vector store (create tables/collections if needed)
 * Also initializes HybridRetriever when HYBRID_ENABLED=true
 */
export async function initializeVectorStore(): Promise<void> {
  const type = detectVectorStoreType();

  if (type === 'hybrid') {
    // Initialize hybrid retriever (which also initializes the underlying kNN provider)
    const { initializeHybridRetriever } = await import('./hybrid-retrieval');
    await initializeHybridRetriever();
    console.log(`[VectorStore] Initialized Hybrid retrieval system`);
    return;
  }

  const provider = getVectorStore();
  await provider.initialize();
  console.log(`[VectorStore] Initialized with ${provider.name} provider`);
}

// Re-export types for convenience
export type { VectorDocument as KBDocument } from './vector-store';
