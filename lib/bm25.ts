/**
 * BM25 关键词检索算法实现
 *
 * BM25 (Best Matching 25) 是一种经典的信息检索算法：
 * - 考虑词频 (TF) 和逆文档频率 (IDF)
 * - 对长文档有长度归一化，避免偏好过长文档
 * - 参数 k1, b 控制词频饱和度和长度归一化强度
 *
 * 使用方式:
 *   const bm25 = new BM25Index();
 *   bm25.addDocuments(documents);         // 灌入文档
 *   const scores = bm25.search(query);    // 查询，返回 { docId, score }
 */

export interface BMDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BMSearchResult {
  docId: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export class BM25Index {
  private documents: BMDocument[] = [];
  private docLengths: number[] = [];         // 每个文档的词数
  private avgDocLength: number = 0;           // 平均文档长度
  private termDocFreq: Map<string, number> = new Map(); // 词 -> 出现在多少文档中 (df)
  private totalDocs: number = 0;

  // BM25 标准参数
  private readonly k1: number;
  private readonly b: number;
  private readonly epsilon: number;

  // 停用词（英文常用 + 常见中文功能词）
  private readonly stopWords: Set<string>;

  constructor(k1 = 1.5, b = 0.75, epsilon = 0.25) {
    this.k1 = k1;
    this.b = b;
    this.epsilon = epsilon;
    this.stopWords = new Set([
      // 英文停用词
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with',
      // 中文常见停用词
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都',
      '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你',
      '会', '着', '没有', '看', '好', '自己', '这', '那', '之', '与',
      '及', '等', '或', '但', '而', '为', '以', '对', '从', '把', '被',
      '把', '让', '使', '由', '于', '向', '往', '在', '对', '比', '如',
    ]);
  }

  // --- 分词：简单按空格/标点分词，并统一小写 ---
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      // 保留英文、数字、中文，替换标点和多余空格
      .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => {
        // 过滤空字符串、单字符（除非是中文）、停用词
        if (!token || token.length < 2) return false;
        if (this.stopWords.has(token)) return false;
        // 过滤纯数字
        if (/^\d+$/.test(token)) return false;
        return true;
      });
  }

  // --- 构建索引 ---
  addDocuments(docs: BMDocument[]): void {
    for (const doc of docs) {
      const tokens = this.tokenize(doc.content);
      this.docLengths.push(tokens.length);
      this.documents.push(doc);

      // 统计词频 (document frequency)
      const seen = new Set<string>();
      for (const term of tokens) {
        if (!seen.has(term)) {
          seen.add(term);
          this.termDocFreq.set(
            term,
            (this.termDocFreq.get(term) ?? 0) + 1
          );
        }
      }
    }

    this.totalDocs = this.documents.length;
    this.avgDocLength =
      this.docLengths.reduce((a, b) => a + b, 0) / (this.totalDocs || 1);
  }

  // --- 计算单个词的 IDF ---
  private idf(term: string): number {
    const df = this.termDocFreq.get(term) ?? 0;
    // IDF 公式：log((N - df + 0.5) / (df + 0.5) + 1)
    // 使用 epsilon 平滑避免 df=N 时 idf=0
    const idfVal = Math.log(
      (this.totalDocs - df + 0.5 + this.epsilon) /
        (df + 0.5 + this.epsilon) + 1
    );
    return Math.max(idfVal, 0);
  }

  // --- 计算单个文档对单个查询词的 BM25 贡献 ---
  private termScore(docIdx: number, term: string, termFreqInQuery: number): number {
    const tokens = this.tokenize(this.documents[docIdx].content);

    // 词在文档中的出现次数
    let tf = 0;
    for (const t of tokens) {
      if (t === term) tf++;
    }

    const docLen = this.docLengths[docIdx];
    const idfVal = this.idf(term);

    // BM25 公式: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl))
    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (this.avgDocLength || 1)));

    return idfVal * (numerator / denominator);
  }

  // --- 搜索 ---
  search(query: string, topK = 20): BMSearchResult[] {
    if (this.totalDocs === 0) return [];

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    // 统计查询词频（查询中同一词出现多次，如短语查询）
    const queryTermFreq = new Map<string, number>();
    for (const term of queryTerms) {
      queryTermFreq.set(term, (queryTermFreq.get(term) ?? 0) + 1);
    }

    // 对每个文档计算 BM25 分数
    const scores: Array<{ docIdx: number; score: number }> = [];

    for (let i = 0; i < this.totalDocs; i++) {
      let docScore = 0;

      for (const [term, qtf] of queryTermFreq) {
        // 只对索引中存在的词计算（避免无意义的 IDF=0）
        if (this.termDocFreq.has(term)) {
          // termScore 内部用 tf=1 做归一化，query 中实际出现 qtf 次则乘以 qtf
          const baseScore = this.termScore(i, term, qtf);
          docScore += baseScore * Math.log(qtf);
        }
      }

      if (docScore > 0) {
        scores.push({ docIdx: i, score: docScore });
      }
    }

    // 按分数降序排列
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map(({ docIdx, score }) => {
      const doc = this.documents[docIdx];
      return {
        docId: doc.id,
        score,
        content: doc.content,
        metadata: doc.metadata,
      };
    });
  }

  // --- 清空索引 ---
  clear(): void {
    this.documents = [];
    this.docLengths = [];
    this.termDocFreq.clear();
    this.totalDocs = 0;
    this.avgDocLength = 0;
  }

  // --- 获取文档数 ---
  getDocCount(): number {
    return this.totalDocs;
  }

  // --- 添加单条文档（增量） ---
  addDocument(doc: BMDocument): void {
    this.addDocuments([doc]);
  }
}

/**
 * 简单的内存 BM25 包装器
 * 在内存中维护文档集合，支持增量添加和查询
 */
export class InMemoryBM25 {
  private index: BM25Index;

  constructor() {
    this.index = new BM25Index();
  }

  buildFromDocuments(docs: BMDocument[]): void {
    this.index.clear();
    this.index.addDocuments(docs);
  }

  addDocuments(docs: BMDocument[]): void {
    this.index.addDocuments(docs);
  }

  search(query: string, topK = 20): BMSearchResult[] {
    return this.index.search(query, topK);
  }

  clear(): void {
    this.index.clear();
  }

  getDocCount(): number {
    return this.index.getDocCount();
  }
}
