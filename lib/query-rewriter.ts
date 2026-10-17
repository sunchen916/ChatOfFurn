/**
 * Query Rewriter - 查询改写器
 * 
 * 当检索结果不充分时，改写查询以获得更好的结果。
 * 
 * 改写策略：
 * 1. 关键词扩展 - 添加同义词、相关词
 * 2. 查询角度变换 - 从不同角度描述问题
 * 3. 约束放宽 - 降低相似度阈值或扩大范围
 * 4. 分解查询 - 将复杂问题拆分为多个简单查询
 * 5. 语言扩展 - 中英文混合查询
 */

import { generateText } from 'ai';
import { getChatProvider, getDefaultChatModelId } from './openai';
import { IntentType } from './intent-router';
import type { MissingInfo, MissingInfoType } from './sufficiency-evaluator';

// ============================================
// Types
// ============================================

export interface RewriteResult {
  /** 改写后的查询列表 */
  queries: string[];
  /** 改写策略 */
  strategy: RewriteStrategy;
  /** 改写理由 */
  reasoning: string;
  /** 原始查询 */
  originalQuery: string;
}

export enum RewriteStrategy {
  /** 关键词扩展 */
  EXPAND = 'expand',
  /** 角度变换 */
  REFRAME = 'reframe',
  /** 约束放宽 */
  RELAX = 'relax',
  /** 查询分解 */
  DECOMPOSE = 'decompose',
  /** 语言扩展 */
  LANGUAGE_MIX = 'language_mix',
  /** 组合策略 */
  COMBINED = 'combined'
}

// 同义词词典
const SYNONYM_DICTIONARY: Record<string, string[]> = {
  // 产品相关
  '沙发': ['sofa', 'couch', '座椅', '三人座', '双人座'],
  'sofa': ['沙发', 'couch', 'sofa bed', 'sectional'],
  '桌子': ['table', 'desk', '茶几', '餐桌', '书桌'],
  'table': ['桌子', 'desk', '茶几', 'dining table', 'coffee table'],
  '椅子': ['chair', 'seat', '办公椅', '餐椅', '餐椅'],
  'chair': ['椅子', 'seat', 'office chair', 'dining chair', 'armchair'],
  
  // 材质相关
  '实木': ['solid wood', 'hardwood', '天然木材', '原木'],
  '皮革': ['leather', '真皮', 'pu皮', 'faux leather'],
  'leather': ['皮革', '真皮', 'genuine leather', 'top grain leather'],
  '布艺': ['fabric', '布料', 'upholstered', 'cloth'],
  'fabric': ['布艺', '布料', 'upholstered', 'velvet', 'linen'],
  
  // 规格相关
  '尺寸': ['size', 'dimension', '规格', 'measurements'],
  '价格': ['price', 'cost', '价钱', '报价', 'fee'],
  'price': ['价格', 'cost', 'pricing', 'rate'],
  '运费': ['shipping', 'delivery', '物流', 'freight'],
  'shipping': ['运费', 'delivery', 'logistics', 'freight cost'],
  
  // 质量相关
  '质量': ['quality', 'craftsmanship', '工艺', '做工'],
  '质量好': ['high quality', 'premium', 'best quality', 'durable'],
  'quality': ['质量', 'craftsmanship', 'standard', 'grade'],
  
  // 政策相关
  '退货': ['return', '退货政策', 'refund', 'exchange'],
  'shipping policy': ['shipping policy', '物流政策', '配送政策', 'shipping terms'],
  
  // 趋势相关
  '流行': ['popular', 'trending', 'hot', 'fashionable'],
  '热门': ['hot', 'popular', 'bestseller', 'trending'],
  'trending': ['流行', '热门', 'popular', 'hot selling'],
  'bestseller': ['畅销', '热卖', 'best seller', 'top seller']
};

// 意图相关的改写提示
const INTENT_REWRITE_HINTS: Partial<Record<IntentType, string[]>> = {
  [IntentType.FACTUAL]: [
    '使用更具体的描述词',
    '添加产品规格参数关键词',
    '使用中英文混合查询'
  ],
  [IntentType.COMPARISON]: [
    '将对比项分开查询',
    '使用比较级词汇',
    '分别查询每个对比对象的详细信息'
  ],
  [IntentType.TREND]: [
    '添加时间相关的词',
    '使用趋势相关关键词',
    '搜索热门/流行相关词'
  ],
  [IntentType.CALCULATION]: [
    '添加数量和单位',
    '明确计算目标',
    '使用计算相关的关键词'
  ],
  [IntentType.REGULATION]: [
    '添加认证/标准关键词',
    '明确目标市场',
    '使用法规相关词汇'
  ],
  [IntentType.RECOMMENDATION]: [
    '添加推荐相关词',
    '明确需求条件',
    '使用评价相关关键词'
  ]
};

// ============================================
// Query Transformation Functions
// ============================================

/**
 * 关键词扩展
 */
function expandKeywords(query: string): string[] {
  const results: string[] = [query];
  const queryLower = query.toLowerCase();
  
  // 查找同义词
  for (const [key, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
    if (queryLower.includes(key.toLowerCase())) {
      for (const synonym of synonyms.slice(0, 2)) {
        // 替换或添加
        const expanded = queryLower.replace(new RegExp(key, 'gi'), synonym);
        if (expanded !== queryLower && !results.includes(expanded)) {
          results.push(expanded);
        }
        // 添加同义词组合
        const added = `${queryLower} ${synonym}`;
        if (!results.includes(added)) {
          results.push(added);
        }
      }
    }
  }
  
  return [...new Set(results)].slice(0, 5);
}

/**
 * 添加中英文混合变体
 */
function addLanguageVariations(query: string): string[] {
  const results: string[] = [];
  const queryLower = query.toLowerCase();
  
  // 检查是否包含中文
  const hasChinese = /[\u4e00-\u9fa5]/.test(query);
  
  if (hasChinese) {
    // 如果有中文，尝试提取关键产品词并翻译
    const chineseTerms = queryLower.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const term of chineseTerms) {
      const synonyms = SYNONYM_DICTIONARY[term];
      if (synonyms) {
        for (const en of synonyms.slice(0, 1)) {
          results.push(queryLower.replace(term, en));
        }
      }
    }
  } else {
    // 如果是英文，尝试添加中文关键词
    const terms = queryLower.split(/\s+/);
    for (const term of terms) {
      const synonyms = SYNONYM_DICTIONARY[term];
      if (synonyms) {
        for (const zh of synonyms.slice(0, 1)) {
          if (/[\u4e00-\u9fa5]/.test(zh)) {
            results.push(`${queryLower} ${zh}`);
          }
        }
      }
    }
  }
  
  return results;
}

/**
 * 放宽约束条件
 */
function relaxConstraints(query: string): string[] {
  const results: string[] = [];
  
  // 移除限制词
  const relaxPatterns = [
    { pattern: /最小|最大|不超过|至少/gi, replacement: '' },
    { pattern: /预算.*?(\d+)/gi, replacement: '产品' },
    { pattern: /价格.*?(\d+)/gi, replacement: '产品' }
  ];
  
  for (const { pattern, replacement } of relaxPatterns) {
    const relaxed = query.replace(pattern, replacement);
    if (relaxed !== query && !results.includes(relaxed)) {
      results.push(relaxed);
    }
  }
  
  // 缩短查询（取核心词）
  const words = query.split(/\s+/);
  if (words.length > 3) {
    const coreQuery = words.slice(0, 3).join(' ');
    if (!results.includes(coreQuery)) {
      results.push(coreQuery);
    }
  }
  
  return results;
}

/**
 * 查询分解
 */
function decomposeQuery(query: string, intent: IntentType): string[] {
  const results: string[] = [];
  
  // 识别复合查询
  const separators = ['和', '与', '、', '和', 'and', 'or', 'vs', '对比'];
  const parts = query.split(new RegExp(separators.join('|'), 'gi'));
  
  if (parts.length > 1) {
    // 返回分解后的子查询
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 2) {
        results.push(trimmed);
      }
    }
  }
  
  // 意图相关的分解策略
  if (intent === IntentType.COMPARISON && results.length === 0) {
    // 对比查询：分别查询每个对象
    results.push(`${query}的优点`);
    results.push(`${query}的缺点`);
  } else if (intent === IntentType.TREND) {
    // 趋势查询：添加时间维度
    results.push(`${query} 2024`);
    results.push(`${query} 最新`);
  } else if (intent === IntentType.FACTUAL) {
    // 事实查询：深入了解
    results.push(`${query} 详情`);
    results.push(`${query} 规格参数`);
  }
  
  return results.slice(0, 3);
}

/**
 * 角度变换
 */
function reframeQuery(query: string, missingTypes: MissingInfoType[]): string[] {
  const results: string[] = [];
  
  // 根据缺失信息类型调整查询角度
  for (const type of missingTypes.slice(0, 2)) {
    switch (type) {
      case 'specification':
        results.push(`${query} 尺寸 规格`);
        results.push(`${query} measurements specs`);
        break;
      case 'price':
        results.push(`${query} 价格 报价`);
        results.push(`${query} price cost`);
        break;
      case 'policy':
        results.push(`${query} 政策 条款`);
        results.push(`${query} policy terms`);
        break;
      case 'review':
        results.push(`${query} 评价 用户反馈`);
        results.push(`${query} review customer feedback`);
        break;
      case 'trend':
        results.push(`${query} 趋势 流行`);
        results.push(`${query} trend popular`);
        break;
      case 'regulation':
        results.push(`${query} 认证 标准`);
        results.push(`${query} certification standard`);
        break;
    }
  }
  
  return results;
}

// ============================================
// Query Rewriter Class
// ============================================

/**
 * 查询改写器
 */
export class QueryRewriter {
  private model: ReturnType<typeof getChatProvider>;
  private useLLM: boolean;
  private maxRewrites: number;

  constructor(options?: {
    useLLM?: boolean;
    maxRewrites?: number;
  }) {
    this.model = getChatProvider()(getDefaultChatModelId());
    this.useLLM = options?.useLLM ?? true;
    this.maxRewrites = options?.maxRewrites ?? 5;
  }

  /**
   * 改写查询
   */
  async rewrite(
    originalQuery: string,
    intent: IntentType,
    missingInfo?: MissingInfo[]
  ): Promise<RewriteResult> {
    const queries: string[] = [originalQuery];
    let strategy: RewriteStrategy = RewriteStrategy.EXPAND;
    const reasoningParts: string[] = [];

    // Step 1: 基础改写
    const expanded = expandKeywords(originalQuery);
    if (expanded.length > 1) {
      queries.push(...expanded.slice(1, 3));
      reasoningParts.push('进行了关键词扩展');
    }

    // Step 2: 语言混合
    const langVariations = addLanguageVariations(originalQuery);
    if (langVariations.length > 0) {
      queries.push(...langVariations.slice(0, 1));
      reasoningParts.push('添加了中英文混合变体');
    }

    // Step 3: 根据缺失信息类型改写
    if (missingInfo && missingInfo.length > 0) {
      const reframed = reframeQuery(originalQuery, missingInfo.map(m => m.type));
      if (reframed.length > 0) {
        queries.push(...reframed.slice(0, 2));
        reasoningParts.push('针对缺失信息进行了角度调整');
        strategy = RewriteStrategy.COMBINED;
      }
    }

    // Step 4: 查询分解
    const decomposed = decomposeQuery(originalQuery, intent);
    if (decomposed.length > 1) {
      queries.push(...decomposed.slice(0, 2));
      reasoningParts.push('对复杂查询进行了分解');
      strategy = RewriteStrategy.COMBINED;
    }

    // Step 5: 约束放宽
    const relaxed = relaxConstraints(originalQuery);
    if (relaxed.length > 0) {
      queries.push(...relaxed.slice(0, 1));
      reasoningParts.push('适度放宽了查询约束');
    }

    // 如果启用 LLM，进行智能改写
    if (this.useLLM && (queries.length < 3 || strategy === RewriteStrategy.EXPAND)) {
      const llmQueries = await this.llmRewrite(originalQuery, intent, missingInfo);
      if (llmQueries.length > 0) {
        queries.push(...llmQueries);
        reasoningParts.push('使用了 LLM 进行智能改写');
        strategy = RewriteStrategy.COMBINED;
      }
    }

    // 去重并限制数量
    const finalQueries = [...new Set(queries)].slice(0, this.maxRewrites);

    return {
      queries: finalQueries,
      strategy,
      reasoning: reasoningParts.join('，') || '使用了基础改写策略',
      originalQuery
    };
  }

  /**
   * 使用 LLM 进行智能改写
   */
  private async llmRewrite(
    query: string,
    intent: IntentType,
    missingInfo?: MissingInfo[]
  ): Promise<string[]> {
    const missingDesc = missingInfo 
      ? `缺少信息类型: ${missingInfo.map(m => m.description).join(', ')}`
      : '无特定缺失信息';

    const intentName: Record<IntentType, string> = {
      [IntentType.FACTUAL]: '事实查询',
      [IntentType.COMPARISON]: '对比分析',
      [IntentType.TREND]: '趋势分析',
      [IntentType.CALCULATION]: '计算任务',
      [IntentType.REGULATION]: '法规咨询',
      [IntentType.RECOMMENDATION]: '推荐请求',
      [IntentType.GENERAL]: '通用对话'
    };

    const prompt = `请改写以下搜索查询，以获得更好的检索结果。

原始查询: "${query}"
问题类型: ${intentName[intent]}
${missingDesc}

请生成 2-3 个不同的改写查询，满足以下要求：
1. 保持原意，但使用不同的表达方式
2. 可以添加同义词、相关词
3. 可以使用中英文混合
4. 针对缺失信息调整查询角度
5. 分解复杂查询为多个简单查询

请以 JSON 格式返回改写结果:
{
  "rewrittenQueries": ["改写1", "改写2", "改写3"]
}`;

    try {
      const result = await generateText({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 300
      });

      const parsed = JSON.parse(result.text.trim());
      return parsed.rewrittenQueries || [];
    } catch (error) {
      console.error('LLM rewrite failed:', error);
      return [];
    }
  }

  /**
   * 批量改写（用于并行查询）
   */
  async rewriteBatch(
    queries: string[],
    intent: IntentType,
    missingInfo?: MissingInfo[]
  ): Promise<RewriteResult[]> {
    const results: RewriteResult[] = [];

    for (const query of queries.slice(0, 5)) {
      const result = await this.rewrite(query, intent, missingInfo);
      results.push(result);
    }

    return results;
  }

  /**
   * 获取改写提示
   */
  getHints(intent: IntentType): string[] {
    return INTENT_REWRITE_HINTS[intent] || [
      '使用更精确的关键词',
      '尝试不同的表达方式',
      '添加相关限制条件'
    ];
  }
}

/**
 * 创建查询改写器的便捷函数
 */
export function createQueryRewriter(
  options?: Parameters<typeof QueryRewriter>[0]
): QueryRewriter {
  return new QueryRewriter(options);
}

/**
 * 快速改写（不使用 LLM）
 */
export function quickRewrite(
  query: string,
  intent: IntentType,
  missingInfo?: MissingInfo[]
): RewriteResult {
  const rewriter = new QueryRewriter({ useLLM: false });
  // 同步调用需要处理
  // 这里返回基础改写结果
  const queries: string[] = [query];
  
  // 基础扩展
  const expanded = expandKeywords(query);
  queries.push(...expanded.slice(1, 3));
  
  // 语言变体
  const langVar = addLanguageVariations(query);
  queries.push(...langVar);
  
  // 去重
  const finalQueries = [...new Set(queries)].slice(0, 5);
  
  return {
    queries: finalQueries,
    strategy: RewriteStrategy.EXPAND,
    reasoning: '使用了基础改写策略（无 LLM）',
    originalQuery: query
  };
}
