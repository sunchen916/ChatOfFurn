/**
 * Knowledge Base Module (Compatibility Shim)
 * 
 * This module is kept for backward compatibility.
 * New code should use lib/vector-store.ts for unified access.
 * 
 * @deprecated Use lib/vector-store.ts instead
 */

import { PrismaClient } from '@prisma/client';
import {
  generateDocId,
  addDocuments,
  querySimilarDocuments,
  clearCollection,
  getCollectionCount,
  deleteDocuments,
  isVectorStoreAvailable,
  initializeVectorStore,
  type VectorDocument,
  type DocumentInput
} from './vector-store';

// Re-export from MySQL provider for direct Prisma access
export { MySQLVectorStore } from './providers/mysql-fulltext';

// Legacy Prisma client getter
let prisma: PrismaClient | null = null;
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Re-export types for backward compatibility
export type { VectorDocument as KBDocument, DocumentInput };

// Re-export convenience functions from vector-store
export {
  generateDocId,
  addDocuments,
  querySimilarDocuments,
  clearCollection,
  getCollectionCount,
  deleteDocuments,
  isVectorStoreAvailable,
  initializeVectorStore
};

/**
 * @deprecated Use initializeVectorStore instead
 */
export async function initializeDatabase(): Promise<void> {
  return initializeVectorStore();
}

/**
 * @deprecated Use isVectorStoreAvailable instead
 */
export async function isKnowledgeBaseAvailable(): Promise<boolean> {
  return isVectorStoreAvailable();
}
