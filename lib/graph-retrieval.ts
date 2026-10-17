/**
 * Graph Retrieval - 图谱检索工具
 * 
 * 知识图谱检索，支持多跳推理和关系路径查询。
 * 
 * 支持的图谱存储后端：
 * - MemoryGraphStore: 内存图谱（开发/测试用）
 * - Neo4jStore: Neo4j 图数据库（生产环境）
 * - MySQLGraphStore: MySQL 实现的关系图谱（轻量级替代）
 * 
 * 功能特性：
 * - 节点查询（按类型、属性）
 * - 关系查询（单跳、多跳）
 * - 路径发现（最短路径、所有路径）
 * - 邻居发现（节点周围的关联节点）
 * - 子图查询（满足条件的局部图）
 */

import { getEmbeddingProvider, getEmbeddingModelId } from './openai';
import { embed } from 'ai';

// ============================================
// Types
// ============================================

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  embedding?: number[];
}

export interface GraphRelation {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  relations: GraphRelation[];
  paths?: GraphPath[];
  metadata: {
    queryTime: number;
    nodeCount: number;
    relationCount: number;
    pathCount?: number;
  };
}

export interface GraphPath {
  nodes: GraphNode[];
  relations: GraphRelation[];
  length: number;
  totalWeight: number;
}

export interface GraphQueryOptions {
  maxDepth?: number;
  maxResults?: number;
  includeRelations?: boolean;
  minSimilarity?: number;
}

// 关系类型常量
export const RELATION_TYPES = {
  // 产品关系
  BELONGS_TO_CATEGORY: 'belongs_to_category',
  HAS_MATERIAL: 'has_material',
  HAS_STYLE: 'has_style',
  SIMILAR_TO: 'similar_to',
  ALTERNATIVE_OF: 'alternative_of',
  
  // 类别关系
  PARENT_CATEGORY: 'parent_category',
  CHILD_CATEGORY: 'child_category',
  SIBLING_CATEGORY: 'sibling_category',
  
  // 知识关系
  RELATED_TO: 'related_to',
  CONTRADICTS: 'contradicts',
  IMPLEMENTS: 'implements',
  REQUIRES: 'requires',
  
  // 时序关系
  REPLACES: 'replaces',
  REPLACED_BY: 'replaced_by',
  EVOLVED_FROM: 'evolved_from'
} as const;

// 节点类型常量
export const NODE_TYPES = {
  PRODUCT: 'product',
  CATEGORY: 'category',
  MATERIAL: 'material',
  STYLE: 'style',
  POLICY: 'policy',
  TREND: 'trend',
  REGULATION: 'regulation',
  MARKET: 'market',
  BRAND: 'brand'
} as const;

// ============================================
// Graph Store Interface
// ============================================

export interface GraphStore {
  /** 初始化图谱 */
  initialize(): Promise<void>;
  
  /** 检查是否可用 */
  isAvailable(): Promise<boolean>;
  
  /** 添加节点 */
  addNode(node: GraphNode): Promise<void>;
  
  /** 添加关系 */
  addRelation(relation: GraphRelation): Promise<void>;
  
  /** 批量添加 */
  addBatch(nodes: GraphNode[], relations: GraphRelation[]): Promise<void>;
  
  /** 查询节点 */
  queryNodes(type?: string, properties?: Record<string, any>): Promise<GraphNode[]>;
  
  /** 查询关系 */
  queryRelations(source?: string, target?: string, type?: string): Promise<GraphRelation[]>;
  
  /** 获取节点的邻居 */
  getNeighbors(nodeId: string, maxDepth?: number): Promise<GraphQueryResult>;
  
  /** 查找路径 */
  findPaths(startId: string, endId: string, maxDepth?: number): Promise<GraphPath[]>;
  
  /** 向量相似度搜索 */
  vectorSearch(query: string, topK?: number): Promise<GraphNode[]>;
  
  /** 清除图谱 */
  clear(): Promise<void>;
  
  /** 获取统计信息 */
  getStats(): Promise<{ nodeCount: number; relationCount: number }>;
}

// ============================================
// Memory Graph Store
// ============================================

/**
 * 内存图谱存储（开发/测试用）
 * 
 * 使用 Map 和 Set 实现简单的内存图谱，
 * 适用于数据量较小的场景。
 */
export class MemoryGraphStore implements GraphStore {
  private nodes: Map<string, GraphNode> = new Map();
  private relations: Map<string, GraphRelation> = new Map();
  private nodeIndex: Map<string, Set<string>> = new Map(); // type -> nodeIds
  private adjacency: Map<string, Set<string>> = new Map(); // nodeId -> related nodeIds
  
  async initialize(): Promise<void> {
    console.log('[MemoryGraphStore] Initialized');
    // 可以在这里加载初始数据
  }
  
  async isAvailable(): Promise<boolean> {
    return true; // 内存存储始终可用
  }
  
  async addNode(node: GraphNode): Promise<void> {
    this.nodes.set(node.id, node);
    
    // 更新类型索引
    if (!this.nodeIndex.has(node.type)) {
      this.nodeIndex.set(node.type, new Set());
    }
    this.nodeIndex.get(node.type)!.add(node.id);
    
    // 初始化邻接表
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
  }
  
  async addRelation(relation: GraphRelation): Promise<void> {
    this.relations.set(relation.id, relation);
    
    // 更新邻接表
    if (!this.adjacency.has(relation.source)) {
      this.adjacency.set(relation.source, new Set());
    }
    this.adjacency.get(relation.source)!.add(relation.target);
    
    if (!this.adjacency.has(relation.target)) {
      this.adjacency.set(relation.target, new Set());
    }
    this.adjacency.get(relation.target)!.add(relation.source);
  }
  
  async addBatch(nodes: GraphNode[], relations: GraphRelation[]): Promise<void> {
    for (const node of nodes) {
      await this.addNode(node);
    }
    for (const relation of relations) {
      await this.addRelation(relation);
    }
  }
  
  async queryNodes(type?: string, properties?: Record<string, any>): Promise<GraphNode[]> {
    let results: GraphNode[] = [];
    
    if (type) {
      const nodeIds = this.nodeIndex.get(type);
      if (nodeIds) {
        results = Array.from(nodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
      }
    } else {
      results = Array.from(this.nodes.values());
    }
    
    if (properties) {
      results = results.filter(node => {
        return Object.entries(properties).every(
          ([key, value]) => node.properties[key] === value
        );
      });
    }
    
    return results;
  }
  
  async queryRelations(
    source?: string, 
    target?: string, 
    type?: string
  ): Promise<GraphRelation[]> {
    let results = Array.from(this.relations.values());
    
    if (source) {
      results = results.filter(r => r.source === source || r.target === source);
    }
    if (target) {
      results = results.filter(r => r.source === target || r.target === target);
    }
    if (type) {
      results = results.filter(r => r.type === type);
    }
    
    return results;
  }
  
  async getNeighbors(nodeId: string, maxDepth: number = 1): Promise<GraphQueryResult> {
    const startTime = Date.now();
    const visited = new Set<string>();
    const nodesToVisit: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    const resultNodes: GraphNode[] = [];
    const resultRelations: GraphRelation[] = [];
    
    while (nodesToVisit.length > 0) {
      const current = nodesToVisit.shift()!;
      
      if (visited.has(current.id) || current.depth > maxDepth) {
        continue;
      }
      visited.add(current.id);
      
      const node = this.nodes.get(current.id);
      if (node) {
        resultNodes.push(node);
      }
      
      const neighbors = this.adjacency.get(current.id) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          nodesToVisit.push({ id: neighborId, depth: current.depth + 1 });
        }
        
        // 收集关系
        const relations = Array.from(this.relations.values()).filter(
          r => (r.source === current.id && r.target === neighborId) ||
               (r.target === current.id && r.source === neighborId)
        );
        resultRelations.push(...relations);
      }
    }
    
    return {
      nodes: resultNodes,
      relations: resultRelations,
      metadata: {
        queryTime: Date.now() - startTime,
        nodeCount: resultNodes.length,
        relationCount: resultRelations.length
      }
    };
  }
  
  async findPaths(startId: string, endId: string, maxDepth: number = 3): Promise<GraphPath[]> {
    const paths: GraphPath[] = [];
    
    const dfs = (
      currentId: string, 
      path: GraphNode[], 
      relations: GraphRelation[],
      visited: Set<string>
    ) => {
      if (currentId === endId) {
        paths.push({
          nodes: [...path],
          relations: [...relations],
          length: relations.length,
          totalWeight: relations.reduce((sum, r) => sum + (r.properties?.weight || 1), 0)
        });
        return;
      }
      
      if (path.length > maxDepth) return;
      
      const neighbors = this.adjacency.get(currentId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          const node = this.nodes.get(neighborId);
          if (!node) continue;
          
          const edgeRelations = Array.from(this.relations.values()).filter(
            r => (r.source === currentId && r.target === neighborId) ||
                 (r.target === currentId && r.source === neighborId)
          );
          
          for (const edge of edgeRelations) {
            visited.add(neighborId);
            dfs(neighborId, [...path, node], [...relations, edge], visited);
            visited.delete(neighborId);
          }
        }
      }
    };
    
    const startNode = this.nodes.get(startId);
    if (!startNode) return paths;
    
    dfs(startId, [startNode], [], new Set([startId]));
    
    // 按路径长度排序
    return paths.sort((a, b) => a.length - b.length);
  }
  
  async vectorSearch(query: string, topK: number = 5): Promise<GraphNode[]> {
    try {
      const embedClient = getEmbeddingProvider();
      const modelId = getEmbeddingModelId();
      
      const embedResult = await embed({
        model: embedClient.embedding(modelId),
        value: query
      });
      
      const queryEmbedding = embedResult.embedding;
      
      // 计算余弦相似度
      const nodes = Array.from(this.nodes.values()).filter(n => n.embedding);
      
      const scored = nodes.map(node => {
        const similarity = this.cosineSimilarity(queryEmbedding, node.embedding!);
        return { node, similarity };
      });
      
      // 按相似度排序
      scored.sort((a, b) => b.similarity - a.similarity);
      
      return scored.slice(0, topK).map(s => s.node);
    } catch (error) {
      console.error('[MemoryGraphStore] Vector search failed:', error);
      // 降级为关键词搜索
      return this.keywordSearch(query, topK);
    }
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
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  private keywordSearch(query: string, topK: number): GraphNode[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);
    
    const nodes = Array.from(this.nodes.values());
    
    const scored = nodes.map(node => {
      const content = `${node.id} ${node.type} ${JSON.stringify(node.properties)}`.toLowerCase();
      let score = 0;
      
      for (const term of queryTerms) {
        if (content.includes(term)) {
          score++;
        }
      }
      
      return { node, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, topK).map(s => s.node);
  }
  
  async clear(): Promise<void> {
    this.nodes.clear();
    this.relations.clear();
    this.nodeIndex.clear();
    this.adjacency.clear();
  }
  
  async getStats(): Promise<{ nodeCount: number; relationCount: number }> {
    return {
      nodeCount: this.nodes.size,
      relationCount: this.relations.size
    };
  }
}

// ============================================
// Graph Retriever Class
// ============================================

/**
 * 图谱检索器
 * 
 * 统一的图谱检索接口，支持多种后端存储
 */
export class GraphRetriever {
  private store: GraphStore;
  private initialized: boolean = false;
  
  constructor(store?: GraphStore) {
    this.store = store || new MemoryGraphStore();
  }
  
  /**
   * 初始化图谱检索器
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.store.initialize();
      this.initialized = true;
      console.log('[GraphRetriever] Initialized');
    }
  }
  
  /**
   * 检查是否可用
   */
  async isAvailable(): Promise<boolean> {
    return this.store.isAvailable();
  }
  
  /**
   * 查询节点
   */
  async queryNodes(
    type?: string, 
    properties?: Record<string, any>
  ): Promise<GraphNode[]> {
    await this.ensureInitialized();
    return this.store.queryNodes(type, properties);
  }
  
  /**
   * 查询关系
   */
  async queryRelations(
    source?: string,
    target?: string,
    type?: string
  ): Promise<GraphRelation[]> {
    await this.ensureInitialized();
    return this.store.queryRelations(source, target, type);
  }
  
  /**
   * 获取邻居节点
   */
  async getNeighbors(
    nodeId: string, 
    options?: GraphQueryOptions
  ): Promise<GraphQueryResult> {
    await this.ensureInitialized();
    return this.store.getNeighbors(nodeId, options?.maxDepth);
  }
  
  /**
   * 发现关联路径
   */
  async discoverPaths(
    startNodeId: string,
    endNodeId: string,
    options?: GraphQueryOptions
  ): Promise<GraphPath[]> {
    await this.ensureInitialized();
    return this.store.findPaths(startNodeId, endNodeId, options?.maxDepth);
  }
  
  /**
   * 语义搜索
   */
  async semanticSearch(
    query: string,
    options?: GraphQueryOptions
  ): Promise<GraphNode[]> {
    await this.ensureInitialized();
    return this.store.vectorSearch(query, options?.maxResults);
  }
  
  /**
   * 添加产品节点及其关联
   */
  async addProduct(
    productId: string,
    productData: Record<string, any>
  ): Promise<void> {
    await this.ensureInitialized();
    
    const node: GraphNode = {
      id: productId,
      type: NODE_TYPES.PRODUCT,
      properties: productData
    };
    
    await this.store.addNode(node);
    
    // 添加类别关系
    if (productData.category) {
      await this.store.addRelation({
        id: `${productId}_category`,
        source: productId,
        target: productData.category,
        type: RELATION_TYPES.BELONGS_TO_CATEGORY,
        properties: {}
      });
    }
    
    // 添加材质关系
    if (productData.material) {
      await this.store.addRelation({
        id: `${productId}_material`,
        source: productId,
        target: productData.material,
        type: RELATION_TYPES.HAS_MATERIAL,
        properties: {}
      });
    }
    
    // 添加风格关系
    if (productData.style) {
      await this.store.addRelation({
        id: `${productId}_style`,
        source: productId,
        target: productData.style,
        type: RELATION_TYPES.HAS_STYLE,
        properties: {}
      });
    }
  }
  
  /**
   * 获取产品的完整上下文（多跳邻居）
   */
  async getProductContext(productId: string): Promise<GraphQueryResult> {
    return this.getNeighbors(productId, { maxDepth: 2 });
  }
  
  /**
   * 查找相似产品
   */
  async findSimilarProducts(
    productId: string,
    limit: number = 5
  ): Promise<GraphNode[]> {
    await this.ensureInitialized();
    
    // 首先获取产品的类别
    const categoryRelations = await this.store.queryRelations(
      productId, undefined, RELATION_TYPES.BELONGS_TO_CATEGORY
    );
    
    if (categoryRelations.length === 0) {
      // 没有类别关系，使用向量相似度
      return this.store.vectorSearch(productId, limit);
    }
    
    const categoryId = categoryRelations[0].target;
    
    // 查找同类别的其他产品
    const categoryProducts = await this.store.queryRelations(
      undefined, categoryId, RELATION_TYPES.BELONGS_TO_CATEGORY
    );
    
    const similarIds = categoryProducts
      .map(r => r.source === categoryId ? r.target : r.source)
      .filter(id => id !== productId)
      .slice(0, limit);
    
    const nodes = await Promise.all(
      similarIds.map(id => this.store.queryNodes(undefined, { id }))
    );
    
    return nodes.flat().filter(n => n.id !== productId);
  }
  
  /**
   * 批量加载数据
   */
  async loadData(
    nodes: GraphNode[],
    relations: GraphRelation[]
  ): Promise<void> {
    await this.ensureInitialized();
    await this.store.addBatch(nodes, relations);
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<{ nodeCount: number; relationCount: number }> {
    return this.store.getStats();
  }
  
  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ============================================
// Global Instance
// ============================================

let globalGraphRetriever: GraphRetriever | null = null;

/**
 * 获取全局图谱检索器实例
 */
export function getGlobalGraphRetriever(): GraphRetriever {
  if (!globalGraphRetriever) {
    globalGraphRetriever = new GraphRetriever();
  }
  return globalGraphRetriever;
}

/**
 * 初始化全局图谱检索器
 */
export async function initializeGraphRetriever(): Promise<void> {
  const retriever = getGlobalGraphRetriever();
  await retriever.initialize();
}
