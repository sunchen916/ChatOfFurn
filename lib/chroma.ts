/**
 * Chroma Vector Database Client (Compatibility Shim)
 * 
 * This module is kept for backward compatibility.
 * New code should use lib/vector-store.ts for unified access.
 * 
 * @deprecated Use lib/vector-store.ts instead
 */

export { ChromaVectorStore } from './providers/chroma';

// Re-export types for backward compatibility
export type { VectorDocument as ChromaDocument, DocumentInput } from './vector-store';
