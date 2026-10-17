/**
 * Chroma Vector Store Provider
 * 
 * Supports local (persistent) and remote Chroma servers.
 * Uses the ChromaClient API from chromadb v1.x.
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import type { DocumentInput, VectorDocument, VectorStoreProvider } from '../vector-store';

export const COLLECTION_NAME = 'furniture_kb';

export class ChromaVectorStore implements VectorStoreProvider {
  readonly type = 'chroma' as const;
  readonly name = 'Chroma';
  
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private collectionName: string;
  
  constructor(collectionName = COLLECTION_NAME) {
    this.collectionName = collectionName;
  }
  
  private async getClient(): Promise<ChromaClient> {
    if (!this.client) {
      const port = process.env.CHROMA_PORT || '8000';
      const persistDir = process.env.CHROMA_PERSIST_DIR;
      
      if (persistDir) {
        // Local persistent mode
        this.client = new ChromaClient({
          path: `http://localhost:${port}`
        });
      } else {
        // Remote mode
        const chromaHost = process.env.CHROMA_HOST || `http://localhost:${port}`;
        this.client = new ChromaClient({ path: chromaHost });
      }
    }
    return this.client;
  }
  
  private async getCollection(): Promise<Collection> {
    if (!this.collection) {
      const client = await this.getClient();
      // getOrCreateCollection returns Collection, not a promise
      this.collection = await client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { description: 'Furniture knowledge base' }
      });
    }
    return this.collection;
  }
  
  async initialize(): Promise<void> {
    const client = await this.getClient();
    const collection = await this.getCollection();
    console.log(`[ChromaVectorStore] Initialized collection "${collection.name}" (ID: ${collection.id})`);
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.heartbeat();
      return true;
    } catch (error) {
      console.warn('[ChromaVectorStore] Not available:', (error as Error).message);
      return false;
    }
  }
  
  async addDocuments(documents: DocumentInput[]): Promise<void> {
    if (documents.length === 0) return;
    
    const collection = await this.getCollection();
    
    const ids: string[] = [];
    const embeddings: number[][] = [];
    const documents_arr: string[] = [];
    const metadatas: Array<Record<string, string | number | boolean>> = [];
    
    for (const doc of documents) {
      ids.push(doc.id);
      documents_arr.push(doc.content);
      
      // Extract embedding from metadata if provided (set by addDocuments in vector-store.ts)
      const embedding = doc.metadata?.embedding as number[] | undefined;
      if (embedding) {
        embeddings.push(embedding);
      }
      
      // Store metadata without the embedding (to avoid serialization issues)
      // Filter to only JSON-serializable values (string/number/boolean) for Chroma
      const { embedding: _embedding, ...rawMeta } = doc.metadata || {};
      const cleanMeta: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(rawMeta)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          cleanMeta[k] = v;
        }
      }
      cleanMeta.source = (cleanMeta.url as string) || (cleanMeta.source as string) || doc.id;
      
      metadatas.push(cleanMeta);
    }
    
    await collection.add({
      ids,
      embeddings: embeddings.length > 0 ? embeddings : undefined,
      documents: documents_arr,
      metadatas
    });
    
    console.log(`[ChromaVectorStore] Added ${documents.length} documents`);
  }
  
  async query(queryText: string, topK = 5, threshold = 0.3): Promise<VectorDocument[]> {
    const collection = await this.getCollection();
    
    const results = await collection.query({
      queryTexts: queryText,
      nResults: topK * 3, // Over-fetch to account for threshold filtering
      include: [
        IncludeEnum.Documents,
        IncludeEnum.Metadatas,
        IncludeEnum.Distances
      ]
    });
    
    const docs: VectorDocument[] = [];
    
    // Chroma returns arrays of arrays (one per query)
    const resultIds = results.ids[0] || [];
    const resultDocs = results.documents[0] || [];
    const resultMetas = results.metadatas[0] || [];
    const resultDistances = results.distances?.[0] || [];
    
    for (let i = 0; i < resultIds.length; i++) {
      const distance = resultDistances[i] ?? 0;
      // Convert distance (lower is better) to similarity (higher is better)
      // Using exponential decay: similarity = e^(-distance)
      const similarity = Math.exp(-distance);
      
      if (similarity < threshold) continue;
      
      const meta = resultMetas[i] as Record<string, unknown> | undefined;
      
      docs.push({
        id: resultIds[i],
        content: resultDocs[i] || '',
        metadata: meta ? {
          ...meta,
          url: meta.url as string || meta.source as string || resultIds[i]
        } : { url: resultIds[i] },
        similarity,
        distance
      });
    }
    
    return docs.slice(0, topK);
  }
  
  async clear(): Promise<void> {
    const collection = await this.getCollection();
    await collection.delete({});
    console.log('[ChromaVectorStore] Cleared all documents');
  }
  
  async count(): Promise<number> {
    const collection = await this.getCollection();
    return collection.count();
  }
  
  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const collection = await this.getCollection();
    await collection.delete({ ids });
    console.log(`[ChromaVectorStore] Deleted ${ids.length} documents`);
  }

  /**
   * Get all documents from the Chroma collection (for BM25 index building)
   */
  async getAllDocuments(): Promise<VectorDocument[]> {
    const collection = await this.getCollection();

    const results = await collection.get({
      include: [
        IncludeEnum.Documents,
        IncludeEnum.Metadatas,
        IncludeEnum.Distances,
      ],
    });

    const docs: VectorDocument[] = [];
    const ids = results.ids || [];
    const docs_arr = results.documents || [];
    const metas = results.metadatas || [];
    const distances = results.distances || [];

    for (let i = 0; i < ids.length; i++) {
      const distance = distances[i] ?? 0;
      const similarity = Math.exp(-distance);
      const meta = metas[i] as Record<string, unknown> | undefined;

      docs.push({
        id: ids[i],
        content: docs_arr[i] || '',
        metadata: meta ? {
          ...meta,
          url: (meta.url as string) || (meta.source as string) || ids[i],
        } : { url: ids[i] },
        similarity,
        distance,
      });
    }

    return docs;
  }
}
