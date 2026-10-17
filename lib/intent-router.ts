/**
 * Intent Router - 意图路由模块
 * 
 * 分析用户问题，判断问题类型和意图，
 * 决定使用哪些工具组合以及执行路径。
 * 
 * 支持的意图类型：
 * - FACTUAL: 事实查询（产品信息、政策、规格等）
 * - COMPARISON: 对比分析（产品对比、价格对比等）
 * - TREND: 趋势分析（市场趋势、热门产品等）
 * - CALCULATION: 计算任务（运费、利润、尺寸等）
 * - REGULATION: 法规咨询（认证、合规、进口要求等）
 * - RECOMMENDATION: 推荐请求（选品建议、产品推荐等）
 * - GENERAL: 通用对话
 */

import { generateText } from 'ai';
import { getChatProvider, getDefaultChatModelId } from './openai';

// ============================================
// Types
// ============================================

export enum IntentType {
  /** 事实查询 - 产品信息、政策、规格等 */
  FACTUAL = 'factual',
  /** 对比分析 - 产品对比、价格对比等 */
  COMPARISON = 'comparison',
  /** 趋势分析 - 市场趋势、热门产品等 */
  TREND = 'trend',
  /** 计算任务 - 运费、利润、尺寸等 */
  CALCULATION = 'calculation',
  /** 法规咨询 - 认证、合规、进口要求等 */
  REGULATION = 'regulation',
  /** 推荐请求 - 选品建议、产品推荐等 */
  RECOMMENDATION = 'recommendation',
  /** 通用对话 */
  GENERAL = 'general'
}

export interface IntentResult {
  /** 主要意图类型 */
  primary: IntentType;
  /** 次要意图类型（可能有多个） */
  secondary: IntentType[];
  /** 置信度 0-1 */
  confidence: number;
  /** 关键实体/参数 */
  entities: Record<string, string>;
  /** 建议的工具组合 */
  recommendedTools: string[];
  /** 推理策略 */
  strategy: ExecutionStrategy;
  /** 分析理由 */
  reasoning: string;
}

export enum ExecutionStrategy {
  /** 单次检索 - 直接查询返回结果 */
  SINGLE_QUERY = 'single_query',
  /** 多路检索 - 同时查询多个数据源 */
  MULTI_QUERY = 'multi_query',
  /** 链式推理 - 顺序执行多个工具 */
  CHAIN = 'chain',
  /** 迭代检索 - 评估-改写-重试循环 */
  ITERATIVE = 'iterative',
  /** 直接计算 - 无需检索，直接计算 */
  DIRECT_CALC = 'direct_calc'
}

// 意图到工具的映射
const INTENT_TOOLS_MAP: Record<IntentType, string[]> = {
  [IntentType.FACTUAL]: ['query_vector_db', 'summarize_knowledge'],
  [IntentType.COMPARISON]: ['compare_products', 'compare_marketplace_prices', 'query_vector_db'],
  [IntentType.TREND]: ['analyze_trends', 'get_trending_furniture', 'search_market_trends'],
  [IntentType.CALCULATION]: ['calculate_shipping', 'estimate_profit', 'compare_packaging'],
  [IntentType.REGULATION]: ['check_regulations', 'query_vector_db'],
  [IntentType.RECOMMENDATION]: ['analyze_trends', 'get_bestseller_analysis', 'get_trending_furniture'],
  [IntentType.GENERAL]: ['query_vector_db']
};

// 意图到策略的映射
const INTENT_STRATEGY_MAP: Record<IntentType, ExecutionStrategy> = {
  [IntentType.FACTUAL]: ExecutionStrategy.SINGLE_QUERY,
  [IntentType.COMPARISON]: ExecutionStrategy.MULTI_QUERY,
  [IntentType.TREND]: ExecutionStrategy.MULTI_QUERY,
  [IntentType.CALCULATION]: ExecutionStrategy.DIRECT_CALC,
  [IntentType.REGULATION]: ExecutionStrategy.SINGLE_QUERY,
  [IntentType.RECOMMENDATION]: ExecutionStrategy.MULTI_QUERY,
  [IntentType.GENERAL]: ExecutionStrategy.SINGLE_QUERY
};

// ============================================
// Intent Patterns - 基于规则快速匹配
// ============================================

const INTENT_PATTERNS: Array<{
  intent: IntentType;
  patterns: RegExp[];
  keywords: string[];
}> = [
  {
    intent: IntentType.FACTUAL,
    patterns: [
      /是什么|什么是|哪个|哪里|怎么|如何.*制作|规格|材质|尺寸|材料|工艺|品牌/,
      /what is|what are|which is|where is|how to make|spec|material|size|dimension/gi
    ],
    keywords: ['产品', '规格', '材质', '尺寸', '材料', '工艺', '政策', '说明']
  },
  {
    intent: IntentType.COMPARISON,
    patterns: [
      /对比|比较|差别|差异|哪个.*好|.*vs\.?|.* versus |区别/,
      /compare|versus|vs|difference|which is better|comparison/gi
    ],
    keywords: ['对比', '比较', '差异', 'vs', ' versus ']
  },
  {
    intent: IntentType.TREND,
    patterns: [
      /趋势|热门|畅销|流行|最好卖|热卖|新兴|趋势/,
      /trend|trending|popular|hot|bestseller|top selling|emerging/gi
    ],
    keywords: ['趋势', '热门', '流行', '畅销', 'bestseller', 'trending']
  },
  {
    intent: IntentType.CALCULATION,
    patterns: [
      /计算|多少钱|价格|运费|成本|利润|报价|报价|费用/,
      /calculate|cost|price|shipping|fee|expense|profit|margin|how much/gi
    ],
    keywords: ['计算', '价格', '运费', '成本', '利润', '费用']
  },
  {
    intent: IntentType.REGULATION,
    patterns: [
      /认证|法规|合规|进口|出口|要求|限制|禁止|认证|证书|标准/,
      /certification|regulation|compliance|import|export|requirement|restriction|certificate|standard/gi
    ],
    keywords: ['认证', '法规', '合规', '进口', '要求', '标准']
  },
  {
    intent: IntentType.RECOMMENDATION,
    patterns: [
      /推荐|建议|合适|适合|选择|挑选|选哪个|买.*好/,
      /recommend|suggest|advice|which one|best for|choose|pick/gi
    ],
    keywords: ['推荐', '建议', '合适', '适合', '选择']
  }
];

// ============================================
// Entity Extractors
// ============================================

interface EntityExtractor {
  pattern: RegExp;
  key: string;
}

const ENTITY_EXTRACTORS: EntityExtractor[] = [
  // 产品类型
  { pattern: /(沙发|椅子|桌子|床|柜子|书架|茶几|餐桌|书桌|办公椅|床垫)/g, key: 'product_type' },
  { pattern: /(sofa|couch|chair|table|bed|cabinet|shelf|desk|mattress)/gi, key: 'product_type_en' },
  // 市场/地区
  { pattern: /(美国|UK|英国|欧洲|德国|法国|澳大利亚|加拿大|日本)/g, key: 'market' },
  { pattern: /(USA|US|United States|UK|Britain|Europe|Germany|France|Australia|Canada|Japan)/gi, key: 'market_en' },
  // 数量
  { pattern: /(\d+)\s*(个|件|套|台|箱)/g, key: 'quantity' },
  { pattern: /(\d+)\s*(pieces?|sets?|units?)/gi, key: 'quantity_en' },
  // 尺寸
  { pattern: /(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/g, key: 'dimensions' },
  // 材质
  { pattern: /(实木|板材|布艺|皮质|金属|玻璃|竹制|藤编)/g, key: 'material' },
  { pattern: /(wooden|wood|solid wood|particle board|fabric|leather|metal|glass|bamboo|rattan)/gi, key: 'material_en' }
];

/**
 * 从文本中提取实体
 */
function extractEntities(text: string): Record<string, string> {
  const entities: Record<string, string> = {};

  for (const extractor of ENTITY_EXTRACTORS) {
    const matches = text.match(extractor.pattern);
    if (matches && matches.length > 0) {
      entities[extractor.key] = matches[0];
    }
  }

  return entities;
}

/**
 * 基于规则快速判断意图
 */
function quickIntentMatch(text: string): { intent: IntentType; score: number }[] {
  const results: { intent: IntentType; score: number }[] = [];

  for (const { intent, patterns, keywords } of INTENT_PATTERNS) {
    let score = 0;

    // 模式匹配得分
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        score += 3;
        pattern.lastIndex = 0; // 重置正则
      }
    }

    // 关键词匹配得分
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }
    }

    if (score > 0) {
      results.push({ intent, score });
    }
  }

  // 按分数排序
  return results.sort((a, b) => b.score - a.score);
}

// ============================================
// Intent Router Class
// ============================================

/**
 * 意图路由器
 * 
 * 分析用户问题，判断意图并推荐执行策略
 */
export class IntentRouter {
  private model: ReturnType<typeof getChatProvider>;
  private useLLM: boolean;

  constructor(options?: { useLLM?: boolean }) {
    this.model = getChatProvider()(getDefaultChatModelId());
    this.useLLM = options?.useLLM ?? true;
  }

  /**
   * 分析用户问题的意图
   */
  async route(userMessage: string): Promise<IntentResult> {
    const text = userMessage.trim();

    // Step 1: 快速规则匹配
    const quickResults = quickIntentMatch(text);
    
    // Step 2: 如果启用 LLM，使用模型进行更精确的判断
    let primary: IntentType = IntentType.GENERAL;
    let secondary: IntentType[] = [];
    let confidence = 0.5;
    let reasoning = '';

    if (this.useLLM && quickResults.length > 0) {
      const llmResult = await this.llmClassify(text, quickResults.map(r => r.intent));
      primary = llmResult.primary;
      secondary = llmResult.secondary;
      confidence = llmResult.confidence;
      reasoning = llmResult.reasoning;
    } else if (quickResults.length > 0) {
      // 仅使用规则匹配结果
      primary = quickResults[0].intent;
      confidence = Math.min(0.9, quickResults[0].score / 5);

      // 收集次要意图
      secondary = quickResults.slice(1, 3).map(r => r.intent);
      reasoning = `规则匹配: ${primary}, 分数: ${quickResults[0].score}`;
    }

    // 提取实体
    const entities = extractEntities(text);

    // 获取推荐工具
    const recommendedTools = this.getRecommendedTools(primary, secondary, entities);

    // 确定执行策略
    const strategy = this.determineStrategy(primary, secondary, confidence);

    return {
      primary,
      secondary,
      confidence,
      entities,
      recommendedTools,
      strategy,
      reasoning
    };
  }

  /**
   * 使用 LLM 进行意图分类
   */
  private async llmClassify(
    text: string,
    candidates: IntentType[]
  ): Promise<{
    primary: IntentType;
    secondary: IntentType[];
    confidence: number;
    reasoning: string;
  }> {
    const candidateNames = candidates.map(c => IntentType[c]).join(', ');

    const prompt = `分析以下用户问题，判断其主要意图。

用户问题: "${text}"

候选意图类型:
- FACTUAL: 事实查询（产品信息、政策、规格等）
- COMPARISON: 对比分析（产品对比、价格对比等）
- TREND: 趋势分析（市场趋势、热门产品等）
- CALCULATION: 计算任务（运费、利润、尺寸等）
- REGULATION: 法规咨询（认证、合规、进口要求等）
- RECOMMENDATION: 推荐请求（选品建议、产品推荐等）
- GENERAL: 通用对话

请以 JSON 格式返回分析结果:
{
  "primary": "意图类型",
  "secondary": ["次要意图1", "次要意图2"],
  "confidence": 0.0-1.0之间的置信度,
  "reasoning": "判断理由（1-2句话）"
}

注意：
1. primary 必须是上述候选类型之一
2. secondary 可以包含0-2个次要意图
3. confidence 根据判断确定性给出，高确定性给出高分数`;

    try {
      const result = await generateText({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 200
      });

      const parsed = JSON.parse(result.text.trim());
      
      return {
        primary: IntentType[parsed.primary as keyof typeof IntentType] || IntentType.GENERAL,
        secondary: (parsed.secondary || []).map((s: string) => 
          IntentType[s as keyof typeof IntentType] || IntentType.GENERAL
        ),
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || ''
      };
    } catch (error) {
      console.error('LLM classification failed, falling back to rules:', error);
      // 降级到规则匹配结果
      return {
        primary: candidates[0] || IntentType.GENERAL,
        secondary: candidates.slice(1, 3),
        confidence: 0.5,
        reasoning: 'LLM分类失败，使用规则匹配'
      };
    }
  }

  /**
   * 根据意图获取推荐工具
   */
  private getRecommendedTools(
    primary: IntentType,
    secondary: IntentType[],
    entities: Record<string, string>
  ): string[] {
    const tools = new Set<string>(INTENT_TOOLS_MAP[primary] || []);

    // 添加次要意图的工具
    for (const sec of secondary) {
      for (const tool of INTENT_TOOLS_MAP[sec] || []) {
        tools.add(tool);
      }
    }

    // 根据实体类型添加工具
    if (entities.market || entities.market_en) {
      tools.add('get_trending_furniture');
      tools.add('check_regulations');
    }

    if (entities.product_type || entities.product_type_en) {
      tools.add('get_bestseller_analysis');
      tools.add('compare_products');
    }

    return Array.from(tools);
  }

  /**
   * 确定执行策略
   */
  private determineStrategy(
    primary: IntentType,
    secondary: IntentType[],
    confidence: number
  ): ExecutionStrategy {
    // 低置信度需要迭代检索
    if (confidence < 0.6) {
      return ExecutionStrategy.ITERATIVE;
    }

    // 次要意图多时需要多路检索
    if (secondary.length >= 2) {
      return ExecutionStrategy.MULTI_QUERY;
    }

    // 返回预定义策略
    return INTENT_STRATEGY_MAP[primary] || ExecutionStrategy.SINGLE_QUERY;
  }

  /**
   * 获取意图的友好名称
   */
  static getIntentName(intent: IntentType): string {
    const names: Record<IntentType, string> = {
      [IntentType.FACTUAL]: '事实查询',
      [IntentType.COMPARISON]: '对比分析',
      [IntentType.TREND]: '趋势分析',
      [IntentType.CALCULATION]: '计算任务',
      [IntentType.REGULATION]: '法规咨询',
      [IntentType.RECOMMENDATION]: '推荐请求',
      [IntentType.GENERAL]: '通用对话'
    };
    return names[intent] || '未知';
  }

  /**
   * 获取策略的友好名称
   */
  static getStrategyName(strategy: ExecutionStrategy): string {
    const names: Record<ExecutionStrategy, string> = {
      [ExecutionStrategy.SINGLE_QUERY]: '单次检索',
      [ExecutionStrategy.MULTI_QUERY]: '多路检索',
      [ExecutionStrategy.CHAIN]: '链式推理',
      [ExecutionStrategy.ITERATIVE]: '迭代检索',
      [ExecutionStrategy.DIRECT_CALC]: '直接计算'
    };
    return names[strategy] || '未知';
  }
}

/**
 * 创建意图路由器的便捷函数
 */
export function createIntentRouter(options?: { useLLM?: boolean }): IntentRouter {
  return new IntentRouter(options);
}
