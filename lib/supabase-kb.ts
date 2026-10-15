/**
 * Knowledge Base Module using Supabase/MySQL
 * 
 * Provides document storage and retrieval for RAG functionality.
 * Uses MySQL FULLTEXT search as a fallback for vector search.
 */

import { PrismaClient } from '@prisma/client';

// Collection name for furniture knowledge base
export const COLLECTION_NAME = 'furniture_knowledge';

// Prisma client singleton
let prisma: PrismaClient | null = null;

/**
 * Get or create the Prisma client
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ============================================
// Document Types
// ============================================

export interface KBDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
}

export interface DocumentInput {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

// ============================================
// Database Operations
// ============================================

/**
 * Add documents to the knowledge base
 */
export async function addDocuments(
  documents: DocumentInput[]
): Promise<void> {
  const client = getPrismaClient();
  
  for (const doc of documents) {
    await client.knowledgeBaseDocument.upsert({
      where: { id: doc.id },
      update: {
        content: doc.content,
        metadata: doc.metadata || {},
        updatedAt: new Date(),
      },
      create: {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata || {},
        source: doc.metadata?.url || 'unknown',
      },
    });
  }
}

/**
 * Query documents using keyword/full-text search
 * Falls back to LIKE search if FULLTEXT is not available
 */
export async function querySimilarDocuments(
  query: string,
  matchCount: number = 5,
  threshold: number = 0.3
): Promise<KBDocument[]> {
  const client = getPrismaClient();
  
  try {
    // Try FULLTEXT search first
    const results = await client.$queryRaw<
      Array<{ id: string; content: string; metadata: any; relevance: number }>
    >`
      SELECT 
        id, 
        content, 
        metadata,
        MATCH(content) AGAINST(${query} IN NATURAL LANGUAGE MODE) as relevance
      FROM KnowledgeBaseDocument
      WHERE MATCH(content) AGAINST(${query} IN NATURAL LANGUAGE MODE)
      ORDER BY relevance DESC
      LIMIT ${matchCount}
    `;
    
    if (results && results.length > 0) {
      return results.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata as Record<string, any> | undefined,
        similarity: Math.min(1, (row.relevance || 0) / 10) // Normalize relevance to 0-1
      }));
    }
  } catch (error) {
    console.log('FULLTEXT search not available, falling back to LIKE search');
  }
  
  // Fallback: Use LIKE-based search with keyword extraction
  return await queryByKeywords(query, matchCount);
}

/**
 * Fallback search using keyword extraction and LIKE
 */
async function queryByKeywords(
  query: string,
  matchCount: number = 5
): Promise<KBDocument[]> {
  const client = getPrismaClient();
  
  // Extract keywords from query
  const keywords = extractKeywords(query);
  
  if (keywords.length === 0) {
    // If no keywords, return recent documents
    const docs = await client.knowledgeBaseDocument.findMany({
      take: matchCount,
      orderBy: { updatedAt: 'desc' },
    });
    
    return docs.map(doc => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata as Record<string, any> | undefined,
      similarity: 0.5
    }));
  }
  
  // Build OR conditions for each keyword
  const conditions = keywords.map(keyword => ({
    content: { contains: keyword }
  }));
  
  const docs = await client.knowledgeBaseDocument.findMany({
    where: {
      OR: conditions
    },
    take: matchCount,
    orderBy: { updatedAt: 'desc' },
  });
  
  // Calculate similarity based on keyword matches
  return docs.map(doc => {
    const contentLower = doc.content.toLowerCase();
    const matchCount = keywords.filter(k => contentLower.includes(k.toLowerCase())).length;
    const similarity = matchCount / keywords.length;
    
    return {
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata as Record<string, any> | undefined,
      similarity
    };
  });
}

/**
 * Extract keywords from a query string
 */
function extractKeywords(query: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    '的', '了', '和', '是', '在', '有', '我', '你', '他', '她', '它',
    '这', '那', '什么', '怎么', '如何', '为什么', '哪个', '哪些',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'need', 'want',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'and', 'or', 'but', 'if', 'then', 'so', 'as', 'that', 'this'
  ]);
  
  return query
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // Keep Chinese and alphanumeric
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word));
}

/**
 * Clear all documents from the collection
 */
export async function clearCollection(): Promise<void> {
  const client = getPrismaClient();
  await client.knowledgeBaseDocument.deleteMany({});
}

/**
 * Get collection count
 */
export async function getCollectionCount(): Promise<number> {
  const client = getPrismaClient();
  return await client.knowledgeBaseDocument.count();
}

/**
 * Delete specific documents by IDs
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  const client = getPrismaClient();
  await client.knowledgeBaseDocument.deleteMany({
    where: { id: { in: ids } }
  });
}

/**
 * Generate a unique ID for a document
 */
export function generateDocId(url: string, index: number): string {
  const hash = url.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${Math.abs(hash)}_${index}_${Date.now()}`;
}

/**
 * Initialize the database (create table if not exists)
 * This uses raw SQL for MySQL FULLTEXT index
 */
export async function initializeDatabase(): Promise<void> {
  const client = getPrismaClient();
  
  try {
    // Check if table exists
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS _KnowledgeBaseDocument (
        id VARCHAR(255) PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSON,
        source VARCHAR(500),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FULLTEXT INDEX ft_content (content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    console.log('Knowledge base table initialized');
  } catch (error) {
    console.log('Table may already exist or FULLTEXT not supported:', error);
  }
}

/**
 * Check if knowledge base is available
 */
export async function isKnowledgeBaseAvailable(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.knowledgeBaseDocument.count();
    return true;
  } catch {
    return false;
  }
}
