/**
 * 混合召回系统 (Hybrid Retrieval)
 *
 * 实现完整的混合检索流程：
 *   BM25 召回 + kNN 召回 → RRF 融合 → 重排 → 候选块
 *
 * RRF (Reciprocal Rank Fusion) 融合公式：
 *   RRF_score(d) = Σ  1 / (k + rank_i(d))
 *   其中 k 为融合常数（通常取 60），rank_i(d) 为第 i 个召回源中文档 d 的排名
 *
 * 容错机制：
 *   - 查询向量化失败 → 保留纯 BM25 检索结果
 *   - 重排异常 → 回退至 RRF 融合结果
 */

import { embed } from 'ai';
import { getEmbeddingProvider, getEmbeddingModelId } from './openai';
import { getVectorStore, VectorDocument } from './vector-store';
import { BM25Index, BMDocument, BMSearchResult } from './bm25';

// ============================================
// Types
// ============================================

export interface HybridSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  /** 融合后的综合分数 (RRF 分数) */
  fusionScore: number;
  /** 原始分数（BM25 或 kNN） */
  bm25Score: number;
  bm25Rank: number;
  knnSimilarity: number;
  knnRank: number;
  /** 融合后的最终排名 */
  rank: number;
}

export interface HybridSearchOptions {
  /** BM25 召回数量 */
  bm25TopK?: number;
  /** kNN 召回数量 */
  knnTopK?: number;
  /** kNN 相似度阈值 */
  knnThreshold?: number;
  /** RRF 融合常数 k（越大越偏向多样性，通常 60） */
  rrfK?: number;
  /** 是否启用重排 */
  enableRerank?: boolean;
  /** 最终返回数量 */
  topK?: number;
  /** 是否使用纯 BM25（当向量化失败时自动降级） */
  bm25Only?: boolean;
}

export interface RRFScoredDoc {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  bm25Score: number;
  bm25Rank: number;
  knnSimilarity: number;
  knnRank: number;
  fusionScore: number;
}

interface BM25DocEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

// ============================================
// RRF 融合
// ============================================

/**
 * Reciprocal Rank Fusion — 多路召回排名融合
 *
 * @param rankedLists 多个召回源的排序结果，每个源是按排名排序的文档 ID 列表
 * @param k 融合常数，默认 60。值越大，RRF 越趋于平等对待各召回源
 *
 * RRF_score(d) = Σ  1 / (k + rank(d))
 *
 * 注意：kNN 和 BM25 列表中相同文档可能排名不同，RRF 会将它们的排名加权求和，
 * 从而综合两种召回的排序信息。
 */
export function reciprocalRankFusion(
  rankedLists: Array<{ docId: string; rank: number }[]>,
  k: number = 60
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const rankedList of rankedLists) {
    for (const { docId, rank } of rankedList) {
      const prev = scores.get(docId) ?? 0;
      scores.set(docId, prev + 1 / (k + rank));
    }
  }

  return scores;
}

// ============================================
// BM25 内存索引管理
// ============================================

/**
 * BM25 内存索引管理器
 *
 * 从向量存储中加载所有文档，构建内存 BM25 索引。
 * 支持增量更新和按需重建。
 */
export class BM25MemoryIndex {
  private index: BM25Index = new BM25Index();
  private docMap: Map<string, BM25DocEntry> = new Map();
  private lastBuildTime: number = 0;
  private isBuilding: boolean = false;
  /** 索引最大存活时间（毫秒），超时后下次查询时重建 */
  private readonly maxAgeMs: number = 5 * 60 * 1000; // 5 分钟

  /**
   * 构建索引：从向量存储加载所有文档并建立 BM25 索引
   */
  async build(): Promise<void> {
    if (this.isBuilding) return;
    this.isBuilding = true;

    try {
      const provider = getVectorStore();

      // 获取全量文档（优先使用 getAllDocuments，避免空查询向量化问题）
      let allDocs: VectorDocument[] = [];
      if (provider.getAllDocuments) {
        allDocs = await provider.getAllDocuments();
      } else {
        // 回退：通过大 topK 召回（部分 provider 不实现 getAllDocuments）
        allDocs = await provider.query('', 2000, 0.0);
      }

      this.index.clear();
      this.docMap.clear();

      for (const doc of allDocs) {
        const entry: BM25DocEntry = {
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata ?? {},
        };
        this.docMap.set(doc.id, entry);
      }

      // 转换为 BM25 格式
      const bm25Docs: BMDocument[] = allDocs.map((doc) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata ?? {},
      }));

      this.index.addDocuments(bm25Docs);
      this.lastBuildTime = Date.now();

      console.log(
        `[BM25Index] Built with ${this.index.getDocCount()} documents`
      );
    } finally {
      this.isBuilding = false;
    }
  }

  /**
   * 检查索引是否需要重建（过期或为空）
   */
  needsRebuild(): boolean {
    if (this.index.getDocCount() === 0) return true;
    return Date.now() - this.lastBuildTime > this.maxAgeMs;
  }

  /**
   * 确保索引已构建（按需重建）
   */
  async ensureBuilt(): Promise<void> {
    if (this.needsRebuild()) {
      await this.build();
    }
  }

  /**
   * 搜索 BM25
   */
  search(query: string, topK: number = 20): BMSearchResult[] {
    return this.index.search(query, topK);
  }

  /**
   * 根据 docId 获取文档内容
   */
  getDoc(docId: string): BM25DocEntry | undefined {
    return this.docMap.get(docId);
  }

  /**
   * 强制重建索引
   */
  async rebuild(): Promise<void> {
    await this.build();
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.index.clear();
    this.docMap.clear();
    this.lastBuildTime = 0;
  }

  get docCount(): number {
    return this.index.getDocCount();
  }
}

// ============================================
// 重排器 (Reranker)
// ============================================

/**
 * 基于原始分数的重排器
 *
 * 在 RRF 融合分数的基础上，引入 kNN 相似度和 BM25 分数的加权组合，
 * 对候选文档做最终排序。
 *
 * 分数公式：
 *   finalScore = rrfWeight * rrfScore
 *              + knnWeight * knnSim * (1 + log(1 + knnRank))
 *              + bm25Weight * log(1 + bm25Score)
 *
 * 权重可配置，默认 rrf=0.5, knn=0.3, bm25=0.2
 */
export interface RerankerWeights {
  rrf: number;
  knn: number;
  bm25: number;
}

const DEFAULT_WEIGHTS: RerankerWeights = {
  rrf: 0.5,
  knn: 0.3,
  bm25: 0.2,
};

export class ScoreReranker {
  private weights: RerankerWeights;

  constructor(weights?: Partial<RerankerWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  rerank(results: RRFScoredDoc[]): RRFScoredDoc[] {
    if (results.length === 0) return results;

    // 找到最大分数用于归一化
    const maxRrf = Math.max(...results.map((r) => r.fusionScore), 1);
    const maxBm25 = Math.max(...results.map((r) => r.bm25Score), 1);

    const scored = results.map((doc) => {
      // 归一化各维度分数
      const normRrf = doc.fusionScore / maxRrf;
      const normKnn = doc.knnSimilarity; // kNN 相似度已在 [0,1]
      const normBm25 = Math.log(1 + doc.bm25Score) / Math.log(1 + maxBm25);

      // 对 knnRank 和 bm25Rank 做排名衰减惩罚
      const knnPenalty = 1 / Math.log(2 + doc.knnRank);
      const bm25Penalty = 1 / Math.log(2 + doc.bm25Rank);

      const finalScore =
        this.weights.rrf * normRrf +
        this.weights.knn * normKnn * knnPenalty +
        this.weights.bm25 * normBm25 * bm25Penalty;

      return { ...doc, finalScore };
    });

    return scored
      .sort((a, b) => (b as any).finalScore - (a as any).finalScore)
      .map((doc, index) => ({ ...doc, rank: index + 1 })) as RRFScoredDoc[];
  }
}

// ============================================
// 混合检索主类
// ============================================

/**
 * 混合检索器
 *
 * 同时执行 BM25 和 kNN 检索，通过 RRF 融合两者结果，
 * 可选启用重排，最终返回质量更高的候选文档。
 *
 * 使用示例：
 * ```typescript
 * const retriever = new HybridRetriever();
 * await retriever.initialize();
 *
 * const results = await retriever.search('真皮沙发 现代风格', { topK: 5 });
 * for (const doc of results) {
 *   console.log(doc.rank, doc.content.substring(0, 50), doc.fusionScore);
 * }
 * ```
 */
export class HybridRetriever {
  private bm25Index: BM25MemoryIndex;
  private reranker: ScoreReranker;
  private vectorizationFailed: boolean = false;

  // 配置项
  private readonly bm25TopK: number;
  private readonly knnTopK: number;
  private readonly rrfK: number;

  constructor(options?: {
    bm25TopK?: number;
    knnTopK?: number;
    rrfK?: number;
    rerankerWeights?: Partial<RerankerWeights>;
  }) {
    this.bm25Index = new BM25MemoryIndex();
    this.reranker = new ScoreReranker(options?.rerankerWeights);
    this.bm25TopK = options?.bm25TopK ?? 50;
    this.knnTopK = options?.knnTopK ?? 50;
    this.rrfK = options?.rrfK ?? 60;
  }

  /**
   * 初始化：构建 BM25 索引
   */
  async initialize(): Promise<void> {
    await this.bm25Index.ensureBuilt();
    console.log(
      `[HybridRetriever] Initialized with ${this.bm25Index.docCount} documents`
    );
  }

  /**
   * 执行混合检索
   *
   * @param query 用户查询
   * @param opts 检索选项
   * @returns 排序后的候选文档列表
   */
  async search(
    query: string,
    opts?: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    const {
      bm25TopK = this.bm25TopK,
      knnTopK = this.knnTopK,
      knnThreshold = 0.3,
      rrfK = this.rrfK,
      enableRerank = true,
      topK = 10,
      bm25Only = false,
    } = opts ?? {};

    // ---- Step 1: BM25 召回 ----
    let bm25Results: BMSearchResult[] = [];
    try {
      await this.bm25Index.ensureBuilt();
      bm25Results = this.bm25Index.search(query, bm25TopK);
    } catch (err) {
      console.error('[HybridRetriever] BM25 search failed:', err);
    }

    // ---- Step 2: kNN 召回 ----
    let knnResults: VectorDocument[] = [];

    if (!bm25Only && !this.vectorizationFailed) {
      try {
        const embedClient = getEmbeddingProvider();
        const modelId = getEmbeddingModelId();

        const embedResult = await embed({
          model: embedClient.embedding(modelId),
          value: query,
        });

        const provider = getVectorStore();
        knnResults = await provider.query(query, knnTopK, knnThreshold);
      } catch (err) {
        console.error(
          '[HybridRetriever] kNN search failed (falling back to BM25 only):',
          err
        );
        this.vectorizationFailed = true;
        knnResults = [];
      }
    }

    // ---- Step 3: RRF 融合 ----
    const fused = this.fuseResults(bm25Results, knnResults, rrfK);

    // ---- Step 4: 重排 ----
    let rankedResults: RRFScoredDoc[];
    if (enableRerank) {
      try {
        rankedResults = this.reranker.rerank(fused);
      } catch (err) {
        console.error('[HybridRetriever] Rerank failed, using RRF results:', err);
        rankedResults = fused.sort((a, b) => b.fusionScore - a.fusionScore);
      }
    } else {
      rankedResults = fused.sort((a, b) => b.fusionScore - a.fusionScore);
    }

    // ---- Step 5: 格式化为最终结果 ----
    const finalResults: HybridSearchResult[] = rankedResults.slice(0, topK).map(
      (doc, index) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        fusionScore: doc.fusionScore,
        bm25Score: doc.bm25Score,
        bm25Rank: doc.bm25Rank,
        knnSimilarity: doc.knnSimilarity,
        knnRank: doc.knnRank,
        rank: index + 1,
      })
    );

    return finalResults;
  }

  /**
   * RRF 融合：合并 BM25 和 kNN 的排名结果
   */
  private fuseResults(
    bm25Results: BMSearchResult[],
    knnResults: VectorDocument[],
    rrfK: number
  ): RRFScoredDoc[] {
    // 构建排名列表
    const bm25Ranked: Array<{ docId: string; rank: number }> = bm25Results.map(
      (r, i) => ({ docId: r.docId, rank: i + 1 })
    );
    const knnRanked: Array<{ docId: string; rank: number }> = knnResults.map(
      (r, i) => ({ docId: r.id, rank: i + 1 })
    );

    // 合并排名（去重，保留两边的文档）
    const allRanked = [
      ...bm25Ranked,
      ...knnRanked.filter(
        (kr) => !bm25Ranked.some((br) => br.docId === kr.docId)
      ),
    ];

    // RRF 融合
    const rrfScores = reciprocalRankFusion([allRanked], rrfK);

    // 构建融合后的文档列表
    const bm25Map = new Map<string, BMSearchResult>();
    for (const r of bm25Results) bm25Map.set(r.docId, r);

    const knnMap = new Map<string, VectorDocument>();
    for (const r of knnResults) knnMap.set(r.id, r);

    const allDocIds = new Set([
      ...bm25Results.map((r) => r.docId),
      ...knnResults.map((r) => r.id),
    ]);

    const fused: RRFScoredDoc[] = [];

    for (const docId of allDocIds) {
      const bm25 = bm25Map.get(docId);
      const knn = knnMap.get(docId);

      const bm25Rank = bm25Ranked.find((r) => r.docId === docId)?.rank ?? 999;
      const knnRank = knnRanked.find((r) => r.docId === docId)?.rank ?? 999;

      fused.push({
        id: docId,
        content: bm25?.content ?? knn?.content ?? '',
        metadata: bm25?.metadata ?? knn?.metadata ?? {},
        bm25Score: bm25?.score ?? 0,
        bm25Rank,
        knnSimilarity: knn?.similarity ?? 0,
        knnRank,
        fusionScore: rrfScores.get(docId) ?? 0,
      });
    }

    return fused;
  }

  /**
   * 重建 BM25 索引（当知识库数据变化时调用）
   */
  async rebuildIndex(): Promise<void> {
    this.vectorizationFailed = false;
    await this.bm25Index.rebuild();
  }

  /**
   * 获取当前 BM25 索引中的文档数量
   */
  getIndexedDocCount(): number {
    return this.bm25Index.docCount;
  }
}

// ============================================
// 单例（应用全局共享一个混合检索器）
// ============================================

let globalHybridRetriever: HybridRetriever | null = null;

/**
 * 获取全局混合检索器实例
 */
export function getGlobalHybridRetriever(): HybridRetriever {
  if (!globalHybridRetriever) {
    globalHybridRetriever = new HybridRetriever({
      bm25TopK: 50,
      knnTopK: 50,
      rrfK: 60,
    });
  }
  return globalHybridRetriever;
}

/**
 * 初始化全局混合检索器（推荐在应用启动时调用一次）
 */
export async function initializeHybridRetriever(): Promise<void> {
  const retriever = getGlobalHybridRetriever();
  await retriever.initialize();
}

/**
 * 使用混合检索器执行查询的便捷函数
 */
export async function hybridSearch(
  query: string,
  options?: HybridSearchOptions
): Promise<HybridSearchResult[]> {
  const retriever = getGlobalHybridRetriever();
  return retriever.search(query, options);
}
