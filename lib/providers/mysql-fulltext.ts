/**
 * MySQL FULLTEXT Provider (Fallback)
 * 
 * Uses MySQL FULLTEXT search as a fallback when Chroma or Supabase
 * are not configured. This does NOT provide true semantic/vector search,
 * only keyword-based full-text matching.
 * 
 * Requires: DATABASE_URL configured in .env.local (MySQL connection string)
 * Prisma model: KnowledgeBaseDocument (from prisma/schema.prisma)
 */

import { PrismaClient } from '@prisma/client';
import type { DocumentInput, VectorDocument, VectorStoreProvider } from '../vector-store';

// Prisma model name (matches schema.prisma)
const TABLE_NAME = 'KnowledgeBaseDocument';

export class MySQLVectorStore implements VectorStoreProvider {
  readonly type = 'mysql' as const;
  readonly name = 'MySQL FULLTEXT';
  
  private prisma: PrismaClient | null = null;
  
  private getPrisma(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient();
    }
    return this.prisma;
  }
  
  async initialize(): Promise<void> {
    const prisma = this.getPrisma();
    
    // Ensure the database is connected
    await prisma.$connect();
    
    // Note: FULLTEXT index must be created in schema.prisma or manually.
    // Prisma does not support FULLTEXT indexes natively.
    try {
      // Try to add a FULLTEXT index on content (MySQL-specific)
      // This is safe to run multiple times (IF NOT EXISTS equivalent)
      await prisma.$executeRawUnsafe(`
        CREATE FULLTEXT INDEX IF NOT EXISTS idx_content_fulltext 
        ON ${TABLE_NAME}(content)
      `);
    } catch (err) {
      // Index may already exist or table might not support FULLTEXT
      console.warn('[MySQLVectorStore] Could not create FULLTEXT index:', (err as Error).message);
    }
    
    console.log('[MySQLVectorStore] Initialized');
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const prisma = this.getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      console.warn('[MySQLVectorStore] Not available:', (err as Error).message);
      return false;
    }
  }
  
  async addDocuments(documents: DocumentInput[]): Promise<void> {
    if (documents.length === 0) return;
    
    const prisma = this.getPrisma();
    
    for (const doc of documents) {
      const { embedding: _emb, url: _url, ...cleanMeta } = doc.metadata || {};
      
      await prisma.knowledgeBaseDocument.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          content: doc.content,
          metadata: cleanMeta as Record<string, string | number | boolean>,
          source: (cleanMeta?.url as string) || doc.id
        },
        update: {
          content: doc.content,
          metadata: cleanMeta as Record<string, string | number | boolean>
        }
      });
    }
    
    console.log(`[MySQLVectorStore] Added/updated ${documents.length} documents`);
  }
  
  async query(queryText: string, topK = 5, threshold = 0.1): Promise<VectorDocument[]> {
    const prisma = this.getPrisma();
    
    // MySQL FULLTEXT search using MATCH AGAINST
    try {
      const words = queryText.trim().split(/\s+/).filter(w => w.length > 1);
      
      if (words.length === 0) return [];
      
      // Build a FULLTEXT query with exact phrase matching
      const matchClause = words.map(w => `"${w.replace(/"/g, '')}"`).join(' ');
      
      const results = await prisma.$queryRawUnsafe<Array<{
        id: string;
        content: string;
        metadata: Record<string, unknown> | null;
        relevance: number;
      }>>(
        `SELECT id, content, metadata,
                MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
         FROM ${TABLE_NAME}
         WHERE MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE)
         ORDER BY relevance DESC
         LIMIT ?`,
        matchClause,
        queryText,
        topK * 3
      ) as Array<{
        id: string;
        content: string;
        metadata: Record<string, unknown> | null;
        relevance: number;
      }>;
      
      // Normalize relevance to similarity (0-1)
      const maxRelevance = Math.max(...results.map(r => Math.abs(r.relevance)), 1);
      
      return results
        .filter(r => {
          const sim = Math.min(Math.abs(r.relevance) / maxRelevance, 1);
          return sim >= threshold;
        })
        .slice(0, topK)
        .map(r => ({
          id: r.id,
          content: r.content,
          metadata: {
            ...(r.metadata || {}),
            url: (r.metadata?.url as string) || r.id
          },
          similarity: Math.min(Math.abs(r.relevance) / maxRelevance, 1),
          distance: 1 - Math.min(Math.abs(r.relevance) / maxRelevance, 1)
        }));
    } catch (err) {
      // Fallback: LIKE-based search if FULLTEXT is not available
      console.warn('[MySQLVectorStore] FULLTEXT query failed, using LIKE fallback:', (err as Error).message);
      
      const words = queryText.trim().split(/\s+/).filter(w => w.length > 2);
      if (words.length === 0) return [];
      
      const conditions = words.map(() => `content LIKE ?`).join(' OR ');
      const params = words.map(w => `%${w}%`);
      
      const results = await prisma.$queryRawUnsafe<Array<{
        id: string;
        content: string;
        metadata: Record<string, unknown> | null;
      }>>(
        `SELECT id, content, metadata FROM ${TABLE_NAME} WHERE ${conditions} LIMIT ?`,
        ...params,
        topK * 3
      ) as Array<{ id: string; content: string; metadata: Record<string, unknown> | null }>;
      
      return results.slice(0, topK).map(r => ({
        id: r.id,
        content: r.content,
        metadata: {
          ...(r.metadata || {}),
          url: (r.metadata?.url as string) || r.id
        },
        similarity: threshold,
        distance: 1 - threshold
      }));
    }
  }
  
  async clear(): Promise<void> {
    const prisma = this.getPrisma();
    await prisma.knowledgeBaseDocument.deleteMany({});
    console.log('[MySQLVectorStore] Cleared all documents');
  }
  
  async count(): Promise<number> {
    const prisma = this.getPrisma();
    return prisma.knowledgeBaseDocument.count();
  }

  /**
   * Get all documents from the MySQL store (for BM25 index building)
   */
  async getAllDocuments(): Promise<VectorDocument[]> {
    const prisma = this.getPrisma();

    const results = await prisma.knowledgeBaseDocument.findMany({
      select: {
        id: true,
        content: true,
        metadata: true,
        source: true,
      },
    });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: {
        ...(typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {}),
        url: (typeof r.metadata === 'object' && r.metadata !== null && 'url' in r.metadata ? r.metadata.url as string : undefined) || r.source || r.id,
      },
      similarity: 1,
      distance: 0,
    }));
  }
  
  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    const prisma = this.getPrisma();
    await prisma.knowledgeBaseDocument.deleteMany({
      where: { id: { in: ids } }
    });
    
    console.log(`[MySQLVectorStore] Deleted ${ids.length} documents`);
  }
}
