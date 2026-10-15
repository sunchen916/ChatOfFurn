/**
 * Chroma Vector Database Client
 * 
 * Chroma is an open-source embedding database that makes it easy to build LLM apps
 * by making knowledge, facts, and skills queryable.
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { getEmbeddingModelId, getEmbeddingProvider } from './openai';

// Collection name for furniture knowledge base
export const COLLECTION_NAME = 'furniture_knowledge';

/**
 * Chroma client singleton
 */
let chromaClient: ChromaClient | null = null;
let currentCollection: Collection | null = null;

/**
 * Get or create the Chroma client
 */
export function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    const persistDirectory = process.env.CHROMA_PERSIST_DIR || './chroma_data';
    
    // Check if it's a remote URL
    if (persistDirectory.includes('http://') || persistDirectory.includes('https://')) {
      chromaClient = new ChromaClient({
        path: persistDirectory
      });
    } else {
      // Local mode: connect to local Chroma server
      // Start the server with: npx chroma run --path ./chroma_data
      const port = process.env.CHROMA_PORT || '8000';
      chromaClient = new ChromaClient({
        path: `http://localhost:${port}`
      });
    }
  }
  return chromaClient;
}

/**
 * Get or create the furniture knowledge collection
 */
export async function getFurnitureCollection(): Promise<Collection> {
  if (!currentCollection) {
    const client = getChromaClient();
    
    try {
      // Try to get existing collection
      currentCollection = await client.getCollection({
        name: COLLECTION_NAME
      });
    } catch {
      // Collection doesn't exist, create it
      currentCollection = await client.createCollection({
        name: COLLECTION_NAME,
        metadata: { description: 'Furniture e-commerce knowledge base' }
      });
    }
  }
  
  return currentCollection;
}

/**
 * Add documents to the vector database
 */
export async function addDocuments(
  documents: Array<{ id: string; content: string; metadata?: Record<string, any> }>
): Promise<void> {
  const collection = await getFurnitureCollection();
  
  const ids = documents.map(doc => doc.id);
  const contents = documents.map(doc => doc.content);
  const metadatas = documents.map(doc => doc.metadata || {});
  
  // Generate embeddings using the embedding provider
  const embedClient = getEmbeddingProvider();
  const embeddings: number[][] = [];
  
  for (const content of contents) {
    const { embed } = await import('ai');
    const result = await embed({
      model: embedClient.embedding(getEmbeddingModelId()),
      value: content
    });
    embeddings.push(result.embedding);
  }
  
  await collection.add({
    ids,
    documents: contents,
    metadatas,
    embeddings
  });
}

/**
 * Query similar documents from the vector database
 */
export async function querySimilarDocuments(
  query: string,
  nResults: number = 5,
  where?: Record<string, any>
): Promise<Array<{
  id: string;
  content: string;
  metadata: Record<string, any>;
  distance?: number;
}>> {
  const collection = await getFurnitureCollection();
  
  // Generate embedding for the query
  const embedClient = getEmbeddingProvider();
  const { embed } = await import('ai');
  const { embedding } = await embed({
    model: embedClient.embedding(getEmbeddingModelId()),
    value: query
  });
  
  // Query the collection
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults,
    where,
    include: [
      IncludeEnum.documents,
      IncludeEnum.metadatas,
      IncludeEnum.distances
    ]
  });
  
  // Format results
  if (!results.ids || results.ids.length === 0 || !results.ids[0]) {
    return [];
  }
  
  return results.ids[0].map((id, index) => ({
    id,
    content: results.documents?.[0]?.[index] || '',
    metadata: results.metadatas?.[0]?.[index] || {},
    distance: results.distances?.[0]?.[index] ?? undefined
  }));
}

/**
 * Delete all documents from the collection
 */
export async function clearCollection(): Promise<void> {
  const collection = await getFurnitureCollection();
  await collection.delete({ where: {} });
}

/**
 * Get collection count
 */
export async function getCollectionCount(): Promise<number> {
  const collection = await getFurnitureCollection();
  return await collection.count();
}

/**
 * Delete specific documents by IDs
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  const collection = await getFurnitureCollection();
  await collection.delete({
    where: { id: { $in: ids } }
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
