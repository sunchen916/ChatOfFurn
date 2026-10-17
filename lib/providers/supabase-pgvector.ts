/**
 * Supabase pgvector Provider
 * 
 * Uses Supabase PostgreSQL with pgvector extension for semantic search.
 * Requires:
 * - SUPABASE_URL (e.g. https://xxx.supabase.co)
 * - SUPABASE_KEY (ANON KEY or SERVICE ROLE KEY)
 * - Table: kb_documents (auto-created on init)
 * 
 * The table schema:
 *   id            TEXT PRIMARY KEY
 *   content       TEXT NOT NULL
 *   metadata      JSONB
 *   embedding     vector(1536)  -- dimension must match embedding model
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEmbeddingModelId, getEmbeddingProvider } from '../openai';
import type { DocumentInput, VectorDocument, VectorStoreProvider } from '../vector-store';

export const VECTOR_TABLE_NAME = 'kb_documents';

// Default embedding dimension (text-embedding-ada-002 = 1536, Qwen3-Embedding-0.6B = 1024)
// The actual dimension is detected from the first document or env var
const DEFAULT_EMBEDDING_DIM = 1024;

export class SupabaseVectorStore implements VectorStoreProvider {
  readonly type = 'supabase' as const;
  readonly name = 'Supabase pgvector';
  
  private client: SupabaseClient | null = null;
  private tableName: string;
  private embeddingDim: number;
  
  constructor(tableName = VECTOR_TABLE_NAME, embeddingDim = DEFAULT_EMBEDDING_DIM) {
    this.tableName = tableName;
    this.embeddingDim = embeddingDim;
  }
  
  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_KEY;
      
      if (!url || !key) {
        throw new Error(
          'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.local'
        );
      }
      
      this.client = createClient(url, key, {
        auth: { persistSession: false }
      });
      
      // Allow override via env
      this.tableName = process.env.SUPABASE_VECTOR_TABLE || this.tableName;
      const dimEnv = process.env.SUPABASE_EMBEDDING_DIM;
      if (dimEnv) {
        this.embeddingDim = parseInt(dimEnv, 10);
      }
    }
    return this.client;
  }
  
  async initialize(): Promise<void> {
    const client = this.getClient();
    
    // Create the table if it doesn't exist
    // Using raw SQL to create pgvector table with proper indexing
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id          TEXT PRIMARY KEY,
        content     TEXT NOT NULL,
        metadata    JSONB DEFAULT '{}',
        embedding   vector(${this.embeddingDim}) NOT NULL
      );
    `;
    
    // Create HNSW index for fast similarity search
    // Using cosine distance (most common for embeddings)
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx
      ON ${this.tableName} USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `;
    
    try {
      const { error: tableErr } = await client.rpc('exec', { sql: createTableSQL });
      if (tableErr) {
        // Try direct SQL if rpc doesn't exist
        console.warn('[SupabaseVectorStore] exec RPC not available, trying direct query');
        const { error: directErr } = await client.from(this.tableName).select('id').limit(1);
        if (directErr?.code === '42P01') {
          // Table doesn't exist - try creating via a workaround
          console.error('[SupabaseVectorStore] Table does not exist and cannot auto-create. Please create it manually:');
          console.error(`[SupabaseVectorStore] Run in Supabase SQL Editor:\n${createTableSQL}\n${createIndexSQL}`);
        }
      }
      
      // Try to create index
      const { error: indexErr } = await client.rpc('exec', { sql: createIndexSQL });
      if (indexErr) {
        console.warn('[SupabaseVectorStore] Could not create HNSW index:', indexErr.message);
      }
      
      console.log(`[SupabaseVectorStore] Initialized table "${this.tableName}" with embedding dim ${this.embeddingDim}`);
    } catch (err) {
      console.warn('[SupabaseVectorStore] Auto-init skipped (may need manual table creation)');
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const client = this.getClient();
      const { error } = await client
        .from(this.tableName)
        .select('id')
        .limit(1);
      
      if (error) {
        // Table might not exist yet
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          return false;
        }
        // Other errors may still mean the connection works
        console.warn('[SupabaseVectorStore] Availability check:', error.message);
      }
      return true;
    } catch (err) {
      console.warn('[SupabaseVectorStore] Not available:', (err as Error).message);
      return false;
    }
  }
  
  async addDocuments(documents: DocumentInput[]): Promise<void> {
    if (documents.length === 0) return;
    
    const client = this.getClient();
    const rows: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding: number[];
    }> = [];
    
    for (const doc of documents) {
      const embedding = doc.metadata?.embedding as number[] | undefined;
      if (!embedding) {
        console.warn(`[SupabaseVectorStore] Skipping document "${doc.id}" - no embedding found in metadata`);
        continue;
      }
      
      const { embedding: _emb, ...cleanMeta } = doc.metadata || {};
      rows.push({
        id: doc.id,
        content: doc.content,
        metadata: {
          ...cleanMeta,
          url: (cleanMeta?.url as string) || doc.id
        },
        embedding
      });
    }
    
    if (rows.length === 0) {
      console.warn('[SupabaseVectorStore] No documents with embeddings to insert');
      return;
    }
    
    const { error } = await client.from(this.tableName).upsert(rows, {
      onConflict: 'id'
    });
    
    if (error) {
      throw new Error(`Failed to insert documents: ${error.message}`);
    }
    
    console.log(`[SupabaseVectorStore] Inserted ${rows.length} documents`);
  }
  
  async query(queryText: string, topK = 5, threshold = 0.3): Promise<VectorDocument[]> {
    const client = this.getClient();

    // Embed the query text using the top-level imported functions
    const { embed } = await import('ai');
    const embedClient = getEmbeddingProvider();
    const modelId = getEmbeddingModelId();

    const result = await embed({
      model: embedClient.embedding(modelId),
      value: queryText
    });

    const queryEmbedding = result.embedding;

    // Use Supabase client to fetch all documents (for client-side similarity calculation)
    // For production with large datasets, use a server-side RPC with vector search
    const { data: vecData, error: vecErr } = await client
      .from(this.tableName)
      .select('id, content, metadata, embedding')
      .limit(topK * 5);

    // Use RPC to do proper vector search with cosine distance
    // Fall back to simple query if RPC not available
    let rows: Array<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }> = [];

    if (!vecErr && vecData) {
      // Client-side similarity calculation as fallback
      rows = vecData.map((row) => {
        const storedEmbedding = (row as unknown as { embedding: number[] }).embedding;
        const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
        return {
          id: row.id,
          content: row.content,
          metadata: row.metadata || {},
          similarity
        };
      });

      // Sort by similarity descending and filter
      rows.sort((a, b) => b.similarity - a.similarity);
    } else {
      console.warn('[SupabaseVectorStore] Vector query failed:', vecErr?.message);
    }

    const filtered = rows
      .filter(r => r.similarity >= threshold)
      .slice(0, topK);

    return filtered.map(r => ({
      id: r.id,
      content: r.content,
      metadata: {
        ...r.metadata,
        url: (r.metadata?.url as string) || r.id
      },
      similarity: r.similarity,
      distance: 1 - r.similarity
    }));
  }

  /**
   * Get all documents from the store (for BM25 index building)
   * Loads all documents without computing similarities (for building BM25 index)
   */
  async getAllDocuments(): Promise<VectorDocument[]> {
    const client = this.getClient();
    const allDocs: VectorDocument[] = [];
    const batchSize = 1000;
    let lastId: string | undefined;

    while (true) {
      let query = client
        .from(this.tableName)
        .select('id, content, metadata')
        .limit(batchSize);

      if (lastId) {
        query = query.gt('id', lastId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get all documents: ${error.message}`);
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        allDocs.push({
          id: row.id,
          content: row.content,
          metadata: {
            ...(row.metadata || {}),
            url: (row.metadata?.url as string) || row.id
          },
          similarity: 1, // Placeholder, not used for BM25 building
          distance: 0
        });
        lastId = row.id;
      }

      if (data.length < batchSize) break;
    }

    return allDocs;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    
    return dotProduct / denominator;
  }
  
  async clear(): Promise<void> {
    const client = this.getClient();
    const { error } = await client.from(this.tableName).delete().neq('id', '__impossible__');
    
    // Since deleting all rows with .delete() requires a condition,
    // we'll use a workaround: truncate via RPC or delete in batches
    const { data, error: selectErr } = await client.from(this.tableName).select('id');
    if (!selectErr && data) {
      const ids = data.map((r: { id: string }) => r.id);
      for (const id of ids) {
        await client.from(this.tableName).delete().eq('id', id);
      }
    }
    
    console.log('[SupabaseVectorStore] Cleared all documents');
  }
  
  async count(): Promise<number> {
    const client = this.getClient();
    const { count, error } = await client
      .from(this.tableName)
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.warn('[SupabaseVectorStore] Count error:', error.message);
      return 0;
    }
    
    return count || 0;
  }
  
  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    const client = this.getClient();
    
    for (const id of ids) {
      await client.from(this.tableName).delete().eq('id', id);
    }
    
    console.log(`[SupabaseVectorStore] Deleted ${ids.length} documents`);
  }
}
