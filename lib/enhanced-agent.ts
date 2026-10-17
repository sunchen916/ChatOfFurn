/**
 * Enhanced Agent - 增强型 Agent
 * 
 * 整合意图路由、充分性评估、查询改写、图谱检索的智能 Agent。
 * 
 * 执行流程：
 * 1. 意图路由 - 分析问题类型和意图
 * 2. 执行路径选择 - 根据意图选择执行策略
 * 3. 知识检索 - 向量检索 + 图谱检索
 * 4. 充分性评估 - 评估检索结果是否充分
 * 5. 查询改写重试 - 不充分时改写并重试
 * 6. 结果整合 - 整合多源结果生成最终回答
 * 
 * 支持的执行策略：
 * - 单次检索：直接查询返回
 * - 多路检索：并行查询多个数据源
 * - 链式推理：顺序执行多个工具
 * - 迭代检索：评估-改写-重试循环
 */

import { generateText, CoreMessage, ToolCallPart, ToolResultPart } from 'ai';
import { getChatProvider, getDefaultChatModelId } from './openai';
import { IntentRouter, IntentType, ExecutionStrategy, createIntentRouter } from './intent-router';
import { SufficiencyEvaluator, createSufficiencyEvaluator, EvaluationResult } from './sufficiency-evaluator';
import { QueryRewriter, createQueryRewriter } from './query-rewriter';
import { getGlobalGraphRetriever, GraphRetriever } from './graph-retrieval';
import { querySimilarDocuments, VectorDocument } from './vector-store';
import { hybridSearch, HybridSearchResult } from './hybrid-retrieval';
import { executeWebSearchTool } from './web-search-tools';

// ============================================
// Types
// ============================================

export interface EnhancedAgentConfig {
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 是否启用图谱检索 */
  enableGraph?: boolean;
  /** 是否启用联网搜索 */
  enableWebSearch?: boolean;
  /** 是否启用充分性评估 */
  enableSufficiencyCheck?: boolean;
  /** 检索结果数量 */
  retrievalTopK?: number;
  /** 相似度阈值 */
  similarityThreshold?: number;
  /** 详细日志 */
  verbose?: boolean;
}

export interface AgentStep {
  step: number;
  type: StepType;
  intent?: IntentType;
  strategy?: ExecutionStrategy;
  queries?: string[];
  toolCalls?: string[];
  evaluation?: EvaluationResult;
  results?: RetrievalResult[];
  reasoning?: string;
  isFinal?: boolean;
}

export enum StepType {
  ROUTING = 'routing',
  RETRIEVAL = 'retrieval',
  EVALUATION = 'evaluation',
  REWRITE = 'rewrite',
  GRAPH = 'graph',
  WEB_SEARCH = 'web_search',
  FINAL = 'final'
}

export interface RetrievalResult {
  source: 'vector' | 'graph' | 'web' | 'calculation';
  query: string;
  documents: (VectorDocument | HybridSearchResult)[];
  evaluation?: EvaluationResult;
}

export interface AgentResponse {
  answer: string;
  reasoningSteps: AgentStep[];
  context: {
    retrieved: number;
    sufficient: boolean;
    iterations: number;
    intent: IntentType;
    strategy: ExecutionStrategy;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Required<EnhancedAgentConfig> = {
  maxIterations: 5,
  maxRetries: 3,
  enableGraph: true,
  enableWebSearch: true,
  enableSufficiencyCheck: true,
  retrievalTopK: 5,
  similarityThreshold: 0.3,
  verbose: false
};

// ============================================
// Enhanced Agent Class
// ============================================

/**
 * 增强型 Agent
 */
export class EnhancedAgent {
  private config: Required<EnhancedAgentConfig>;
  private model: ReturnType<typeof getChatProvider>;
  private intentRouter: IntentRouter;
  private sufficiencyEvaluator: SufficiencyEvaluator;
  private queryRewriter: QueryRewriter;
  private graphRetriever: GraphRetriever;
  
  constructor(config: EnhancedAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.model = getChatProvider()(getDefaultChatModelId());
    this.intentRouter = createIntentRouter({ useLLM: true });
    this.sufficiencyEvaluator = createSufficiencyEvaluator({ useLLM: true });
    this.queryRewriter = createQueryRewriter({ useLLM: true });
    this.graphRetriever = getGlobalGraphRetriever();
  }

  /**
   * 运行 Agent 处理用户问题
   */
  async run(userMessage: string, chatHistory: CoreMessage[] = []): Promise<AgentResponse> {
    const reasoningSteps: AgentStep[] = [];
    let step = 0;
    let currentIntent: IntentType = IntentType.GENERAL;
    let currentStrategy: ExecutionStrategy = ExecutionStrategy.SINGLE_QUERY;
    let allResults: RetrievalResult[] = [];
    let sufficient = false;

    if (this.config.verbose) {
      console.log('[EnhancedAgent] Starting with:', userMessage);
    }

    // Step 1: 意图路由
    step++;
    const intentResult = await this.intentRouter.route(userMessage);
    currentIntent = intentResult.primary;
    currentStrategy = intentResult.strategy;

    reasoningSteps.push({
      step,
      type: StepType.ROUTING,
      intent: currentIntent,
      strategy: currentStrategy,
      queries: [userMessage],
      reasoning: `${IntentRouter.getIntentName(currentIntent)} - ${intentResult.reasoning}`
    });

    if (this.config.verbose) {
      console.log(`[EnhancedAgent] Intent: ${IntentRouter.getIntentName(currentIntent)}, Strategy: ${ExecutionStrategy[currentStrategy]}`);
    }

    // Step 2: 根据策略执行检索
    let iteration = 0;
    const maxTotalIterations = this.config.maxIterations + this.config.maxRetries;

    while (!sufficient && iteration < maxTotalIterations) {
      iteration++;

      // 向量检索
      const vectorResult = await this.performVectorRetrieval(userMessage, intentResult);
      allResults.push(vectorResult);

      // 图谱检索（如果启用）
      if (this.config.enableGraph) {
        const graphResult = await this.performGraphRetrieval(userMessage);
        if (graphResult.documents.length > 0) {
          allResults.push(graphResult);
        }
      }

      // 联网搜索（对于趋势、计算类问题）
      if (this.config.enableWebSearch && 
          (currentIntent === IntentType.TREND || currentIntent === IntentType.RECOMMENDATION)) {
        const webResult = await this.performWebSearch(userMessage);
        if (webResult.documents.length > 0) {
          allResults.push(webResult);
        }
      }

      // 充分性评估
      if (this.config.enableSufficiencyCheck) {
        const allDocuments = allResults.flatMap(r => r.documents);
        const evaluation = await this.sufficiencyEvaluator.evaluate(
          allDocuments,
          userMessage,
          currentIntent
        );

        reasoningSteps.push({
          step: step + iteration,
          type: StepType.EVALUATION,
          evaluation,
          reasoning: `充分性: ${(evaluation.sufficiency * 100).toFixed(0)}%`
        });

        sufficient = evaluation.isSufficient;

        // 如果不充分且还有重试机会，进行查询改写
        if (!sufficient && iteration < this.config.maxRetries) {
          step++;
          const rewriteResult = await this.queryRewriter.rewrite(
            userMessage,
            currentIntent,
            evaluation.missingInformation
          );

          reasoningSteps.push({
            step,
            type: StepType.REWRITE,
            queries: rewriteResult.queries,
            reasoning: rewriteResult.reasoning
          });

          // 使用改写后的查询继续
          userMessage = rewriteResult.queries[1] || rewriteResult.queries[0];
        }
      } else {
        sufficient = true;
      }
    }

    // Step 3: 生成最终回答
    step++;
    const finalContext = this.buildContext(allResults);
    const answer = await this.generateAnswer(userMessage, finalContext, chatHistory);

    reasoningSteps.push({
      step,
      type: StepType.FINAL,
      isFinal: true,
      reasoning: '生成最终回答'
    });

    return {
      answer,
      reasoningSteps,
      context: {
        retrieved: allResults.reduce((sum, r) => sum + r.documents.length, 0),
        sufficient,
        iterations: iteration,
        intent: currentIntent,
        strategy: currentStrategy
      }
    };
  }

  /**
   * 执行向量检索
   */
  private async performVectorRetrieval(
    query: string,
    intent: any
  ): Promise<RetrievalResult> {
    let documents: (VectorDocument | HybridSearchResult)[] = [];

    try {
      // 优先使用混合检索
      documents = await hybridSearch(query, {
        topK: this.config.retrievalTopK,
        knnThreshold: this.config.similarityThreshold,
        bm25TopK: 50,
        knnTopK: 50
      });
    } catch (error) {
      // 降级到普通向量检索
      if (this.config.verbose) {
        console.log('[EnhancedAgent] Falling back to vector retrieval');
      }
      documents = await querySimilarDocuments(
        query,
        this.config.retrievalTopK,
        this.config.similarityThreshold
      );
    }

    return {
      source: 'vector',
      query,
      documents
    };
  }

  /**
   * 执行图谱检索
   */
  private async performGraphRetrieval(query: string): Promise<RetrievalResult> {
    try {
      const isAvailable = await this.graphRetriever.isAvailable();
      if (!isAvailable) {
        return { source: 'graph', query, documents: [] };
      }

      // 尝试向量搜索
      const nodes = await this.graphRetriever.semanticSearch(query, { maxResults: 5 });

      // 转换为 VectorDocument 格式
      const documents: VectorDocument[] = nodes.map(node => ({
        id: node.id,
        content: JSON.stringify(node.properties),
        metadata: {
          ...node.properties,
          nodeType: node.type
        },
        similarity: 0.8 // 图谱节点默认较高相似度
      }));

      return {
        source: 'graph',
        query,
        documents
      };
    } catch (error) {
      if (this.config.verbose) {
        console.error('[EnhancedAgent] Graph retrieval error:', error);
      }
      return { source: 'graph', query, documents: [] };
    }
  }

  /**
   * 执行联网搜索
   */
  private async performWebSearch(query: string): Promise<RetrievalResult> {
    try {
      // 根据查询类型选择合适的搜索工具
      let toolName = 'search_market_trends';
      
      if (query.includes('价格') || query.includes('price')) {
        toolName = 'search_furniture_price';
      } else if (query.includes('热门') || query.includes('trending')) {
        toolName = 'get_trending_furniture';
      } else if (query.includes('畅销') || query.includes('bestseller')) {
        toolName = 'get_bestseller_analysis';
      }

      const result = await executeWebSearchTool(toolName, { 
        topic: query,
        limit: 5 
      });

      // 解析结果（简化处理）
      const documents: VectorDocument[] = [{
        id: `web_${Date.now()}`,
        content: result,
        metadata: { source: 'web' },
        similarity: 0.7
      }];

      return {
        source: 'web',
        query,
        documents
      };
    } catch (error) {
      if (this.config.verbose) {
        console.error('[EnhancedAgent] Web search error:', error);
      }
      return { source: 'web', query, documents: [] };
    }
  }

  /**
   * 构建上下文
   */
  private buildContext(results: RetrievalResult[]): string {
    const parts: string[] = [];

    for (const result of results) {
      if (result.documents.length === 0) continue;

      const sourceLabel = {
        vector: '【知识库检索结果】',
        graph: '【图谱关联信息】',
        web: '【网络搜索结果】',
        calculation: '【计算结果】'
      }[result.source];

      parts.push(sourceLabel);
      parts.push(`查询: ${result.query}`);

      for (const doc of result.documents.slice(0, 3)) {
        const content = 'content' in doc ? doc.content : JSON.stringify(doc);
        parts.push(`- ${content.substring(0, 300)}...`);
      }

      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * 生成最终回答
   */
  private async generateAnswer(
    query: string,
    context: string,
    chatHistory: CoreMessage[]
  ): Promise<string> {
    const systemPrompt = `你是 ChaTofFun，专注服务「外贸家具网站」的智能运营助手。

基于以下检索结果回答用户问题。如果信息不足，请明确说明。

${context}

回答规范：
1. 优先使用检索到的信息
2. 引用来源时说明
3. 使用中文，Markdown 格式
4. 涉及法规政策时建议咨询专业机构
5. 不确定的信息要明确说明`;

    const historySection = chatHistory.length > 0
      ? `\n\n对话历史：\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    const result = await generateText({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: query + historySection }
      ],
      maxTokens: 2000,
      temperature: 0.7
    });

    return result.text;
  }

  /**
   * 流式运行（生成器版本）
   */
  async *runStream(
    userMessage: string,
    chatHistory: CoreMessage[] = []
  ): AsyncGenerator<{
    type: 'step' | 'complete';
    data: AgentStep | AgentResponse;
  }> {
    const result = await this.run(userMessage, chatHistory);

    for (const step of result.reasoningSteps) {
      yield { type: 'step', data: step };
    }

    yield { type: 'complete', data: result };
  }
}

/**
 * 创建增强型 Agent 的便捷函数
 */
export function createEnhancedAgent(
  config?: EnhancedAgentConfig
): EnhancedAgent {
  return new EnhancedAgent(config);
}

// ============================================
// Tool Integration for AI SDK
// ============================================

/**
 * 获取增强 Agent 的工具定义
 */
export function getEnhancedAgentTools(): Record<string, any> {
  return {
    query_vector_db: {
      description: 'Query the vector database for relevant information from the furniture website knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          top_k: { type: 'number', description: 'Number of results', default: 5 },
          threshold: { type: 'number', description: 'Similarity threshold', default: 0.3 }
        },
        required: ['query']
      }
    },
    query_knowledge_graph: {
      description: 'Query the knowledge graph for related entities and relationships. Use for finding product relationships, category hierarchies, or multi-hop reasoning.',
      parameters: {
        type: 'object',
        properties: {
          entity: { type: 'string', description: 'Entity ID or name to query' },
          depth: { type: 'number', description: 'Traversal depth', default: 1 }
        },
        required: ['entity']
      }
    },
    assess_sufficiency: {
      description: 'Assess whether the current information is sufficient to answer the user question. Use when unsure if more search is needed.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Original user query' },
          context: { type: 'string', description: 'Current retrieved context' }
        },
        required: ['query', 'context']
      }
    },
    rewrite_query: {
      description: 'Rewrite the query to get better search results. Use when current results are not sufficient.',
      parameters: {
        type: 'object',
        properties: {
          original_query: { type: 'string', description: 'The original query' },
          missing_info: { type: 'string', description: 'Description of missing information' }
        },
        required: ['original_query']
      }
    }
  };
}

/**
 * 执行增强 Agent 工具
 */
export async function executeEnhancedTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'query_knowledge_graph': {
      const graph = getGlobalGraphRetriever();
      const isAvailable = await graph.isAvailable();
      
      if (!isAvailable) {
        return 'Knowledge graph is not available.';
      }

      const entity = params.entity as string;
      const depth = (params.depth as number) || 1;
      
      const result = await graph.getNeighbors(entity, { maxDepth: depth });
      
      return JSON.stringify({
        nodes: result.nodes,
        relations: result.relations,
        metadata: result.metadata
      }, null, 2);
    }

    case 'assess_sufficiency': {
      const evaluator = createSufficiencyEvaluator({ useLLM: false });
      const query = params.query as string;
      
      // 快速评估
      const mockResults: VectorDocument[] = [];
      const result = evaluator.quickEvaluate(mockResults, query, IntentType.GENERAL);
      
      return JSON.stringify({
        isSufficient: result.isSufficient,
        sufficiency: result.sufficiency,
        suggestions: result.suggestions
      }, null, 2);
    }

    case 'rewrite_query': {
      const rewriter = createQueryRewriter({ useLLM: true });
      const query = params.original_query as string;
      
      const result = await rewriter.rewrite(query, IntentType.GENERAL);
      
      return JSON.stringify({
        queries: result.queries,
        strategy: result.strategy,
        reasoning: result.reasoning
      }, null, 2);
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
