/**
 * Sufficiency Evaluator - 充分性评估器
 * 
 * 评估检索结果是否足够回答用户问题，
 * 决定是否需要改写查询、补充搜索或使用其他工具。
 * 
 * 评估维度：
 * - 相关性 (Relevance): 检索结果与问题的匹配程度
 * - 覆盖度 (Coverage): 检索结果是否覆盖问题的各个维度
 * - 精确度 (Precision): 检索结果的准确性
 * - 新鲜度 (Freshness): 检索结果是否是最新的
 */

import { generateText } from 'ai';
import { getChatProvider, getDefaultChatModelId } from './openai';
import { IntentType } from './intent-router';
import type { VectorDocument } from './vector-store';
import type { HybridSearchResult } from './hybrid-retrieval';

// ============================================
// Types
// ============================================

export interface EvaluationResult {
  /** 总体充分性评分 0-1 */
  sufficiency: number;
  /** 是否充分，可以回答问题 */
  isSufficient: boolean;
  /** 各维度评分 */
  dimensions: {
    relevance: number;      // 相关性 0-1
    coverage: number;      // 覆盖度 0-1
    precision: number;     // 精确度 0-1
    freshness: number;     // 新鲜度 0-1
  };
  /** 缺失的信息类型 */
  missingInformation: MissingInfo[];
  /** 改进建议 */
  suggestions: string[];
  /** 评估理由 */
  reasoning: string;
}

export interface MissingInfo {
  /** 缺失信息类型 */
  type: MissingInfoType;
  /** 描述 */
  description: string;
  /** 建议的查询方式 */
  suggestedQuery?: string;
}

export enum MissingInfoType {
  /** 产品规格/参数 */
  SPECIFICATION = 'specification',
  /** 价格/成本信息 */
  PRICE = 'price',
  /** 政策/条款 */
  POLICY = 'policy',
  /** 操作指南 */
  GUIDANCE = 'guidance',
  /** 比较信息 */
  COMPARISON = 'comparison',
  /** 最新趋势 */
  TREND = 'trend',
  /** 法规要求 */
  REGULATION = 'regulation',
  /** 计算数据 */
  CALCULATION = 'calculation',
  /** 用户评价/反馈 */
  REVIEW = 'review',
  /** 通用信息 */
  GENERAL = 'general'
}

// 结果阈值配置
const SUFFICIENCY_THRESHOLDS = {
  // 是否充分的最低分数
  MIN_SUFFICIENCY: 0.5,
  // 各维度最低分数
  MIN_RELEVANCE: 0.4,
  MIN_COVERAGE: 0.3,
  MIN_PRECISION: 0.3,
  // 改写重试的分数范围
  REWRITE_THRESHOLD: 0.3,  // 低于此分数必须改写
  ACCEPTABLE_THRESHOLD: 0.6 // 高于此分数可直接回答
};

// ============================================
// Quick Evaluation Rules
// ============================================

const INTENT_MISSING_INFO_MAP: Partial<Record<IntentType, MissingInfoType[]>> = {
  [IntentType.FACTUAL]: [MissingInfoType.SPECIFICATION, MissingInfoType.POLICY],
  [IntentType.COMPARISON]: [MissingInfoType.PRICE, MissingInfoType.SPECIFICATION],
  [IntentType.TREND]: [MissingInfoType.TREND, MissingInfoType.REVIEW],
  [IntentType.CALCULATION]: [MissingInfoType.CALCULATION, MissingInfoType.PRICE],
  [IntentType.REGULATION]: [MissingInfoType.REGULATION],
  [IntentType.RECOMMENDATION]: [MissingInfoType.TREND, MissingInfoType.REVIEW]
};

/**
 * 从结果中提取关键信息类型
 */
function categorizeResults(results: (VectorDocument | HybridSearchResult)[]): Set<MissingInfoType> {
  const categories = new Set<MissingInfoType>();

  for (const result of results) {
    const content = result.content.toLowerCase();
    const metadata = result.metadata || {};

    // 检测内容类型
    if (/\d+\s*(cm|mm|m|inch|inch)/.test(content) || 
        /尺寸|规格|参数/.test(content)) {
      categories.add(MissingInfoType.SPECIFICATION);
    }
    
    if (/\$\d|价格|成本|fee|price|cost/i.test(content) ||
        /¥\d|报价/.test(content)) {
      categories.add(MissingInfoType.PRICE);
    }
    
    if (/政策|条款|退换货|保修|shipping policy/i.test(content) ||
        /退货|退款|shipping/i.test(content)) {
      categories.add(MissingInfoType.POLICY);
    }
    
    if (/如何|怎么|步骤|指南|tutorial|guide|how to/i.test(content)) {
      categories.add(MissingInfoType.GUIDANCE);
    }
    
    if (/趋势|流行|热门|bestseller|trending|popular/i.test(content)) {
      categories.add(MissingInfoType.TREND);
    }
    
    if (/法规|认证|合规|标准|certification|regulation|compliance/i.test(content)) {
      categories.add(MissingInfoType.REGULATION);
    }
    
    if (/评价|评论|反馈|review|customer/i.test(content)) {
      categories.add(MissingInfoType.REVIEW);
    }
  }

  return categories;
}

/**
 * 计算基础分数（基于规则）
 */
function calculateQuickScore(
  results: (VectorDocument | HybridSearchResult)[],
  userQuery: string,
  intent: IntentType
): {
  dimensions: EvaluationResult['dimensions'];
  missing: MissingInfo[];
} {
  const dimensions: EvaluationResult['dimensions'] = {
    relevance: 0,
    coverage: 0,
    precision: 0,
    freshness: 0
  };

  const missing: MissingInfo[] = [];
  const queryLower = userQuery.toLowerCase();

  // 无结果
  if (!results || results.length === 0) {
    return {
      dimensions,
      missing: [{
        type: MissingInfoType.GENERAL,
        description: '没有找到相关信息'
      }]
    };
  }

  // 计算相关性 - 基于相似度/融合分数
  let totalSimilarity = 0;
  let relevanceCount = 0;

  for (const result of results) {
    const similarity = 'similarity' in result 
      ? result.similarity 
      : 'fusionScore' in result 
        ? result.fusionScore / 2  // 归一化 fusionScore
        : 0.5;
    
    totalSimilarity += similarity;
    relevanceCount++;
  }

  dimensions.relevance = Math.min(1, totalSimilarity / Math.max(relevanceCount, 1) * 2);

  // 计算精确度 - 查询词在结果中出现的次数
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
  let matchCount = 0;
  let totalMatches = 0;

  for (const result of results) {
    const contentLower = result.content.toLowerCase();
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        matchCount++;
      }
      totalMatches++;
    }
  }

  dimensions.precision = totalMatches > 0 ? matchCount / totalMatches : 0.5;

  // 计算覆盖度 - 基于结果数量和内容类型多样性
  const categories = categorizeResults(results);
  const expectedCategories = INTENT_MISSING_INFO_MAP[intent] || [MissingInfoType.GENERAL];
  const coveredCategories = expectedCategories.filter(c => categories.has(c));
  
  dimensions.coverage = results.length >= 3 
    ? Math.min(1, coveredCategories.length / expectedCategories.length + 0.3)
    : results.length / 5;

  // 计算新鲜度 - 基于元数据中的日期
  let hasDate = false;
  for (const result of results) {
    const metadata = result.metadata || {};
    if (metadata.createdAt || metadata.updatedAt || metadata.date) {
      hasDate = true;
      // 简单判断：如果有日期，认为是新鲜的
      dimensions.freshness = 0.7;
      break;
    }
  }
  
  if (!hasDate) {
    dimensions.freshness = 0.5; // 默认中等新鲜度
  }

  // 识别缺失信息
  const foundCategories = new Set<MissingInfoType>();
  for (const result of results) {
    const contentLower = result.content.toLowerCase();
    
    // 检测产品规格
    if (/\d+\s*(cm|mm|m|inch)/.test(content) || /尺寸|规格/.test(content)) {
      foundCategories.add(MissingInfoType.SPECIFICATION);
    }
    
    // 检测价格
    if (/\$\d|价格|cost|price/i.test(content) || /¥\d/.test(content)) {
      foundCategories.add(MissingInfoType.PRICE);
    }
    
    // 检测政策
    if (/退换货|退货|退款|shipping policy/i.test(content)) {
      foundCategories.add(MissingInfoType.POLICY);
    }
    
    // 检测趋势
    if (/趋势|流行|热门|bestseller|trending/i.test(content)) {
      foundCategories.add(MissingInfoType.TREND);
    }
    
    // 检测法规
    if (/法规|认证|合规|certification|regulation/i.test(content)) {
      foundCategories.add(MissingInfoType.REGULATION);
    }
  }

  // 添加缺失信息的建议
  const keyTerms = queryTerms.slice(0, 3);
  for (const expected of expectedCategories) {
    if (!foundCategories.has(expected)) {
      missing.push({
        type: expected,
        description: `缺少 ${expected} 相关信息`,
        suggestedQuery: `包含${getMissingInfoName(expected)}的${keyTerms.join(' ')}`
      });
    }
  }

  return { dimensions, missing };
}

/**
 * 获取缺失信息类型的中文名称
 */
function getMissingInfoName(type: MissingInfoType): string {
  const names: Record<MissingInfoType, string> = {
    [MissingInfoType.SPECIFICATION]: '规格参数',
    [MissingInfoType.PRICE]: '价格',
    [MissingInfoType.POLICY]: '政策条款',
    [MissingInfoType.GUIDANCE]: '操作指南',
    [MissingInfoType.COMPARISON]: '对比信息',
    [MissingInfoType.TREND]: '趋势信息',
    [MissingInfoType.REGULATION]: '法规要求',
    [MissingInfoType.CALCULATION]: '计算数据',
    [MissingInfoType.REVIEW]: '用户评价',
    [MissingInfoType.GENERAL]: '相关信息'
  };
  return names[type] || '相关信息';
}

/**
 * 生成改进建议
 */
function generateSuggestions(
  dimensions: EvaluationResult['dimensions'],
  missing: MissingInfo[],
  results: (VectorDocument | HybridSearchResult)[]
): string[] {
  const suggestions: string[] = [];

  if (dimensions.relevance < SUFFICIENCY_THRESHOLDS.MIN_RELEVANCE) {
    suggestions.push('检索结果相关性较低，建议改写查询使用更精确的关键词');
  }

  if (dimensions.coverage < SUFFICIENCY_THRESHOLDS.MIN_COVERAGE) {
    suggestions.push('信息覆盖度不足，建议补充搜索其他角度或使用更多数据源');
  }

  if (dimensions.precision < SUFFICIENCY_THRESHOLDS.MIN_PRECISION) {
    suggestions.push('检索精确度较低，建议使用更具体的查询词');
  }

  if (dimensions.freshness < 0.5) {
    suggestions.push('信息可能不是最新的，建议搜索最新数据');
  }

  if (results.length < 3) {
    suggestions.push('检索结果数量较少，建议扩展查询范围');
  }

  if (missing.length > 0) {
    suggestions.push(`缺少以下信息: ${missing.map(m => m.description).join(', ')}`);
  }

  if (suggestions.length === 0) {
    suggestions.push('检索结果充分，可以直接回答');
  }

  return suggestions;
}

// ============================================
// Sufficiency Evaluator Class
// ============================================

/**
 * 充分性评估器
 * 
 * 评估检索结果是否足够回答用户问题
 */
export class SufficiencyEvaluator {
  private model: ReturnType<typeof getChatProvider>;
  private useLLM: boolean;
  private thresholds: typeof SUFFICIENCY_THRESHOLDS;

  constructor(options?: {
    useLLM?: boolean;
    thresholds?: Partial<typeof SUFFICIENCY_THRESHOLDS>;
  }) {
    this.model = getChatProvider()(getDefaultChatModelId());
    this.useLLM = options?.useLLM ?? true;
    this.thresholds = { ...SUFFICIENCY_THRESHOLDS, ...options?.thresholds };
  }

  /**
   * 评估检索结果是否充分
   */
  async evaluate(
    results: (VectorDocument | HybridSearchResult)[],
    userQuery: string,
    intent: IntentType
  ): Promise<EvaluationResult> {
    // 快速规则评估
    const quickResult = calculateQuickScore(results, userQuery, intent);
    let { dimensions, missing } = quickResult;

    // 如果启用 LLM，进行更深入的评估
    if (this.useLLM && results.length > 0) {
      const llmResult = await this.llmEvaluate(results, userQuery, intent, dimensions);
      dimensions = llmResult.dimensions;
      missing = [...missing, ...llmResult.additionalMissing].slice(0, 5);
    }

    // 计算总体充分性分数
    const sufficiency = this.calculateSufficiency(dimensions);

    // 判断是否充分
    const isSufficient = sufficiency >= this.thresholds.MIN_SUFFICIENCY;

    // 生成建议
    const suggestions = generateSuggestions(dimensions, missing, results);

    // 生成理由
    const reasoning = this.generateReasoning(sufficiency, dimensions, missing);

    return {
      sufficiency,
      isSufficient,
      dimensions,
      missingInformation: missing,
      suggestions,
      reasoning
    };
  }

  /**
   * 快速评估（仅使用规则）
   */
  quickEvaluate(
    results: (VectorDocument | HybridSearchResult)[],
    userQuery: string,
    intent: IntentType
  ): EvaluationResult {
    const quickResult = calculateQuickScore(results, userQuery, intent);
    const sufficiency = this.calculateSufficiency(quickResult.dimensions);
    const suggestions = generateSuggestions(quickResult.dimensions, quickResult.missing, results);

    return {
      sufficiency,
      isSufficient: sufficiency >= this.thresholds.MIN_SUFFICIENCY,
      dimensions: quickResult.dimensions,
      missingInformation: quickResult.missing,
      suggestions,
      reasoning: this.generateReasoning(sufficiency, quickResult.dimensions, quickResult.missing)
    };
  }

  /**
   * 使用 LLM 进行深度评估
   */
  private async llmEvaluate(
    results: (VectorDocument | HybridSearchResult)[],
    userQuery: string,
    intent: IntentType,
    baseDimensions: EvaluationResult['dimensions']
  ): Promise<{
    dimensions: EvaluationResult['dimensions'];
    additionalMissing: MissingInfo[];
  }> {
    // 构建评估上下文
    const resultSummaries = results.slice(0, 5).map((r, i) => 
      `[${i + 1}] ${r.content.substring(0, 200)}...`
    ).join('\n');

    const prompt = `评估以下检索结果是否足够回答用户问题。

用户问题: "${userQuery}"
问题类型: ${IntentType[intent]}

检索结果摘要（前5条）:
${resultSummaries}

已有评分:
- 相关性: ${baseDimensions.relevance.toFixed(2)}
- 覆盖度: ${baseDimensions.coverage.toFixed(2)}
- 精确度: ${baseDimensions.precision.toFixed(2)}
- 新鲜度: ${baseDimensions.freshness.toFixed(2)}

请以 JSON 格式返回评估结果:
{
  "dimensions": {
    "relevance": 0-1之间的评分,
    "coverage": 0-1之间的评分,
    "precision": 0-1之间的评分,
    "freshness": 0-1之间的评分
  },
  "additionalMissing": [
    {"type": "缺失信息类型", "description": "缺失描述"}
  ]
}

缺失信息类型可选: specification, price, policy, guidance, comparison, trend, regulation, calculation, review, general`;

    try {
      const result = await generateText({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 300
      });

      const parsed = JSON.parse(result.text.trim());

      return {
        dimensions: {
          relevance: parsed.dimensions?.relevance ?? baseDimensions.relevance,
          coverage: parsed.dimensions?.coverage ?? baseDimensions.coverage,
          precision: parsed.dimensions?.precision ?? baseDimensions.precision,
          freshness: parsed.dimensions?.freshness ?? baseDimensions.freshness
        },
        additionalMissing: (parsed.additionalMissing || []).map((m: any) => ({
          type: MissingInfoType[m.type as keyof typeof MissingInfoType] || MissingInfoType.GENERAL,
          description: m.description || ''
        }))
      };
    } catch (error) {
      console.error('LLM evaluation failed, using base dimensions:', error);
      return {
        dimensions: baseDimensions,
        additionalMissing: []
      };
    }
  }

  /**
   * 计算总体充分性分数
   */
  private calculateSufficiency(dimensions: EvaluationResult['dimensions']): number {
    // 加权平均
    const weights = {
      relevance: 0.4,
      coverage: 0.25,
      precision: 0.2,
      freshness: 0.15
    };

    return (
      weights.relevance * dimensions.relevance +
      weights.coverage * dimensions.coverage +
      weights.precision * dimensions.precision +
      weights.freshness * dimensions.freshness
    );
  }

  /**
   * 生成评估理由
   */
  private generateReasoning(
    sufficiency: number,
    dimensions: EvaluationResult['dimensions'],
    missing: MissingInfo[]
  ): string {
    const parts: string[] = [];

    if (sufficiency >= 0.7) {
      parts.push('检索结果总体质量良好');
    } else if (sufficiency >= 0.5) {
      parts.push('检索结果基本满足需求，有改进空间');
    } else {
      parts.push('检索结果不足以回答问题，需要补充信息');
    }

    if (dimensions.relevance < 0.5) {
      parts.push('相关性有待提高');
    }

    if (dimensions.coverage < 0.5) {
      parts.push('信息覆盖不够全面');
    }

    if (missing.length > 0) {
      parts.push(`缺少 ${missing.length} 类关键信息`);
    }

    return parts.join('，') + '。';
  }

  /**
   * 判断是否应该改写重试
   */
  shouldRewrite(result: EvaluationResult): boolean {
    return result.sufficiency < this.thresholds.REWRITE_THRESHOLD || 
           result.missingInformation.length > 2;
  }

  /**
   * 判断是否可以接受当前结果
   */
  isAcceptable(result: EvaluationResult): boolean {
    return result.sufficiency >= this.thresholds.ACCEPTABLE_THRESHOLD;
  }

  /**
   * 获取改进后的目标分数
   */
  getTargetSufficiency(): number {
    return this.thresholds.ACCEPTABLE_THRESHOLD;
  }
}

/**
 * 创建充分性评估器的便捷函数
 */
export function createSufficiencyEvaluator(
  options?: Parameters<typeof SufficiencyEvaluator>[0]
): SufficiencyEvaluator {
  return new SufficiencyEvaluator(options);
}
