/**
 * Chat API Route with ReAct Agent - Enhanced Version
 * 
 * Implements ReAct (Reasoning + Acting) paradigm with:
 * - Extended tool support (shipping, regulations, profit, etc.)
 * - Improved error handling
 * - Streaming reasoning steps
 * - Conversation memory support
 * - Intent routing
 * - Sufficiency evaluation
 * - Query rewriting
 * - Graph retrieval
 */

import { CoreMessage } from 'ai';
import { streamText, generateText } from 'ai';
import {
  getChatProvider,
  getDefaultChatModelId,
} from '@/lib/openai';
import { querySimilarDocuments, getCurrentProviderInfo } from '@/lib/vector-store';
import { AGENT_TOOLS } from '@/lib/react-agent';
import { EXTENDED_TOOLS, executeExtendedTool } from '@/lib/extended-tools';
import { createConversationMemory, ConversationMemoryManager } from '@/lib/conversation-memory';
import { createIntentRouter, IntentRouter, IntentType, ExecutionStrategy } from '@/lib/intent-router';
import { createSufficiencyEvaluator, SufficiencyEvaluator } from '@/lib/sufficiency-evaluator';
import { createQueryRewriter, QueryRewriter } from '@/lib/query-rewriter';
import { getGlobalGraphRetriever, GraphRetriever } from '@/lib/graph-retrieval';
import { hybridSearch, HybridSearchResult } from '@/lib/hybrid-retrieval';
import { executeWebSearchTool } from '@/lib/web-search-tools';
import type { VectorDocument } from '@/lib/vector-store';

// Initialize clients
const chat = getChatProvider();

// Initialize components for enhanced routing
const intentRouter = new IntentRouter();
const sufficiencyEvaluator = new SufficiencyEvaluator({ useLLM: true });
const queryRewriter = new QueryRewriter({ useLLM: true });
const graphRetriever = getGlobalGraphRetriever();

// Combine all tools
const ALL_TOOLS = [...AGENT_TOOLS, ...EXTENDED_TOOLS];

// ============================================
// Enhanced Retrieval Functions
// ============================================

interface RetrievalResult {
  source: 'vector' | 'graph' | 'web';
  query: string;
  documents: (VectorDocument | HybridSearchResult)[];
  similarity?: number;
}

/**
 * 执行增强检索（向量 + 图谱 + 联网）
 */
async function enhancedRetrieval(
  query: string,
  intent: IntentType,
  topK: number = 5
): Promise<RetrievalResult[]> {
  const results: RetrievalResult[] = [];

  // 1. 向量检索（混合检索）
  try {
    let vectorDocs: (VectorDocument | HybridSearchResult)[] = [];
    
    // 优先使用混合检索
    vectorDocs = await hybridSearch(query, {
      topK,
      knnThreshold: 0.3,
      bm25TopK: 50,
      knnTopK: 50
    });

    results.push({
      source: 'vector',
      query,
      documents: vectorDocs
    });
  } catch (error) {
    console.error('Vector retrieval failed:', error);
  }

  // 2. 图谱检索（对于 FACTUAL/COMPARISON 类型）
  if (intent === IntentType.FACTUAL || intent === IntentType.COMPARISON) {
    try {
      const isGraphAvailable = await graphRetriever.isAvailable();
      if (isGraphAvailable) {
        const graphNodes = await graphRetriever.semanticSearch(query, { maxResults: 5 });
        if (graphNodes.length > 0) {
          const graphDocs: VectorDocument[] = graphNodes.map(node => ({
            id: node.id,
            content: JSON.stringify(node.properties),
            metadata: { ...node.properties, nodeType: node.type },
            similarity: 0.8
          }));

          results.push({
            source: 'graph',
            query,
            documents: graphDocs
          });
        }
      }
    } catch (error) {
      console.error('Graph retrieval failed:', error);
    }
  }

  // 3. 联网搜索（对于 TREND/RECOMMENDATION 类型）
  if (intent === IntentType.TREND || intent === IntentType.RECOMMENDATION) {
    try {
      let toolName = 'search_market_trends';
      if (query.includes('价格') || query.includes('price')) {
        toolName = 'search_furniture_price';
      } else if (query.includes('热门') || query.includes('trending')) {
        toolName = 'get_trending_furniture';
      }

      const webResult = await executeWebSearchTool(toolName, { topic: query, limit: 5 });
      results.push({
        source: 'web',
        query,
        documents: [{
          id: `web_${Date.now()}`,
          content: webResult,
          metadata: { source: 'web_search' },
          similarity: 0.7
        } as VectorDocument]
      });
    } catch (error) {
      console.error('Web search failed:', error);
    }
  }

  return results;
}

/**
 * 构建检索上下文
 */
function buildRetrievalContext(results: RetrievalResult[]): string {
  const parts: string[] = [];

  for (const result of results) {
    if (result.documents.length === 0) continue;

    const sourceLabel = {
      vector: '【知识库检索结果】',
      graph: '【图谱关联信息】',
      web: '【网络搜索结果】'
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
 * Query the vector database for relevant context
 * Supports hybrid retrieval when HYBRID_ENABLED=true
 */
async function fetchRelevantContext(
  query: string,
  matchCount: number = 5,
  threshold: number = 0.3
): Promise<string> {
  try {
    // Uses top-level import from '@/lib/vector-store'
    // When HYBRID_ENABLED=true, this automatically routes to HybridRetriever
    const results = await querySimilarDocuments(query, matchCount, threshold);

    if (!results || results.length === 0) {
      return '知识库中没有找到相关信息。';
    }

    // Results include fusion scores when using hybrid retrieval
    return results.map((item) => `
      Source: ${item.metadata?.url || item.id}
      Created: ${item.metadata?.createdAt || 'N/A'}
      Similarity: ${(item.similarity || 0).toFixed(3)}
      Content: ${item.content}
    `).join('\n---\n');
  } catch (error) {
    console.error('Vector DB exception:', error);
    return '知识库查询出错，使用通用知识回答。';
  }
}

/**
 * Execute a tool by name
 */
async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  // First check extended tools
  const extendedToolNames = EXTENDED_TOOLS.map(t => t.name);
  if (extendedToolNames.includes(toolName)) {
    return executeExtendedTool(toolName, params);
  }
  
  // Fall back to vector DB tools
  if (toolName === 'query_vector_db') {
    return executeVectorDBTool(params);
  }
  
  if (toolName === 'analyze_trends') {
    return executeAnalyzeTrends(params);
  }
  
  if (toolName === 'compare_products') {
    return executeCompareProducts(params);
  }
  
  if (toolName === 'summarize_knowledge') {
    return executeSummarizeKnowledge(params);
  }
  
  return `Unknown tool: ${toolName}`;
}

/**
 * Execute vector DB query tool
 */
async function executeVectorDBTool(params: Record<string, unknown>): Promise<string> {
  try {
    const query = params.query as string || '';
    const topK = (params.top_k as number) || 5;
    const threshold = (params.threshold as number) || 0.3;

    const results = await querySimilarDocuments(query, topK, threshold);

    if (!results || results.length === 0) {
      return '未找到相关信息。';
    }

    // Vector store returns similarity directly (0-1, higher = better)
    return JSON.stringify(results.map((item) => ({
      source: item.metadata?.url || item.id,
      date: item.metadata?.createdAt,
      content: item.content,
      similarity: item.similarity || 0
    })), null, 2);
  } catch (error) {
    return `查询出错: ${error}`;
  }
}

/**
 * Execute analyze trends tool
 */
async function executeAnalyzeTrends(params: Record<string, unknown>): Promise<string> {
  const category = params.category as string || '';
  const market = params.market as string || '';
  
  try {
    const query = `${category} ${market} trending bestseller`;
    const results = await querySimilarDocuments(query, 8, 0.1);
    
    return JSON.stringify({
      category,
      market,
      trends_found: results?.length || 0,
      data: results || []
    }, null, 2);
  } catch (error) {
    return `趋势分析失败: ${error}`;
  }
}

/**
 * Execute compare products tool
 */
async function executeCompareProducts(params: Record<string, unknown>): Promise<string> {
  const productIds = params.product_ids as string[] || [];
  
  try {
    const combinedQuery = productIds.join(' ');
    const results = await querySimilarDocuments(combinedQuery, 10, 0.1);
    
    return JSON.stringify({
      products_found: results?.length || 0,
      data: results || []
    }, null, 2);
  } catch (error) {
    return `产品对比失败: ${error}`;
  }
}

/**
 * Execute summarize knowledge tool
 */
async function executeSummarizeKnowledge(params: Record<string, unknown>): Promise<string> {
  const topic = params.topic as string || '';
  
  try {
    const results = await querySimilarDocuments(topic, 5, 0.1);
    
    return JSON.stringify({
      topic,
      summary_points: results?.map((item) => ({
        source: item.metadata?.url || item.id,
        content: item.content
      })) || []
    }, null, 2);
  } catch (error) {
    return `知识总结失败: ${error}`;
  }
}

/**
 * System prompt for the enhanced chat with reasoning
 */
function createEnhancedSystemPrompt(context: string, conversationHistory?: string): string {
  const historySection = conversationHistory 
    ? `\n**对话历史摘要：**\n${conversationHistory}\n` 
    : '';
  
  return `
你是 ChaTofFun，专注服务「外贸家具网站」的智能运营助手。

**核心能力：**
- 选品推荐与趋势分析
- Listing 优化与文案撰写
- 材质、工艺与认证咨询
- 跨境物流与包装方案
- 利润核算与定价策略

**检索系统说明：**
本系统使用混合检索（Hybrid Retrieval）：
- BM25：基于关键词匹配的经典信息检索算法，擅长精确术语匹配
- kNN：基于向量嵌入的语义检索，擅长捕捉语义相似性
- RRF 融合：将 BM25 和 kNN 的排名结果通过倒数排名融合算法合并
- 重排（Rerank）：综合融合分数、向量相似度、BM25 分数进行精细排序
- 容错机制：向量化失败时自动降级为纯 BM25 检索，重排异常时回退至融合结果

**回答规范：**
1. 优先使用知识库数据，其次使用工具计算
2. 引用来源时说明 URL 和更新日期
3. 不编造具体数字，基于实际数据
4. 使用中文，Markdown 格式
5. 涉及法规政策时，建议咨询专业机构
${historySection}

**上下文信息（混合检索结果）：**
----------------
${context || '暂无上下文，使用通用知识回答'}
----------------

**当前时间**: ${new Date().toLocaleString('zh-CN')}
`;
}

/**
 * POST handler for chat with ReAct agent
 */
export async function POST(req: Request) {
  try {
    const { messages, useReasoning = true, useEnhancedRouting = false } = await req.json();
    
    const latestMessage = messages.at(-1);
    if (!latestMessage || latestMessage.role !== 'user') {
      return new Response('Invalid request: no user message', { status: 400 });
    }
    
    const userQuestion = latestMessage.content;
    
    if (useEnhancedRouting) {
      // 使用增强路由模式（意图路由 + 充分性评估 + 查询改写）
      return handleEnhancedStream(messages, userQuestion);
    }
    
    if (useReasoning) {
      return handleReActStream(messages, userQuestion);
    }
    
    return handleSimpleRAG(messages, userQuestion);
    
  } catch (err) {
    console.error('Chat API Error:', err);
    return new Response(JSON.stringify({ 
      error: '服务器错误',
      message: err instanceof Error ? err.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle chat with ReAct agent streaming
 */
async function handleReActStream(messages: CoreMessage[], userQuestion: string) {
  const encoder = new TextEncoder();

  // Build conversation history for context
  const chatHistory: CoreMessage[] = messages.slice(0, -1).map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content
  }));

  const conversationHistory = chatHistory.length > 0
    ? chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')
    : undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let stepCount = 0;

      try {
        // Fetch context using Chroma
        const context = await fetchRelevantContext(userQuestion, 5, 0.35);

        // Send initial context
        controller.enqueue(
          encoder.encode(`event: context\ndata: ${JSON.stringify({ context })}\n\n`)
        );

        // Create enhanced messages
        const enhancedMessages: CoreMessage[] = [
          { role: 'system', content: createEnhancedSystemPrompt(context, conversationHistory) },
          ...chatHistory,
          { role: 'user', content: userQuestion }
        ];

        // Build tools object
        const toolsObj: Record<string, any> = {};
        for (const tool of ALL_TOOLS) {
          toolsObj[tool.name] = {
            description: tool.description,
            parameters: tool.parameters
          };
        }

        // Stream response with usage tracking
        const startTime = Date.now();
        let promptTokens = 0;
        let completionTokens = 0;

        const result = streamText({
          model: chat(getDefaultChatModelId()),
          messages: enhancedMessages as any,
          tools: toolsObj,
          maxToolRoundtrips: 6,
          temperature: 0.7,
          onFinish: ({ usage, finishTime }: any) => {
            promptTokens = usage?.promptTokens ?? 0;
            completionTokens = usage?.completionTokens ?? 0;
            const elapsed = finishTime
              ? Math.round((finishTime - startTime) / 1000)
              : 0;

            controller.enqueue(
              encoder.encode(`event: usage\ndata: ${JSON.stringify({
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                elapsedSeconds: elapsed,
                tokensPerSecond: elapsed > 0 ? Math.round(completionTokens / elapsed) : 0,
              })}\n\n`)
            );
          },
          onStepFinish: async ({ step, toolCalls, text, toolResults }: any) => {
            stepCount++;

            if (toolCalls && toolCalls.length > 0) {
              // Send reasoning step
              const reasoningStep = {
                step: stepCount,
                thought: `分析问题并决定调用 ${toolCalls.length} 个工具`,
                action: toolCalls.map(tc => `${tc.toolName}(${JSON.stringify(tc.args)})`).join(', '),
                toolName: toolCalls[0].toolName,
                toolParams: toolCalls[0].args,
                isFinal: false
              };

              controller.enqueue(
                encoder.encode(`event: reasoning\ndata: ${JSON.stringify(reasoningStep)}\n\n`)
              );
            }

            if (toolResults && toolResults.length > 0) {
              // Send observation
              const observation = {
                step: stepCount,
                thought: '工具执行完成，观察结果',
                observation: typeof toolResults[0].result === 'string'
                  ? toolResults[0].result
                  : JSON.stringify(toolResults[0].result),
                isFinal: false
              };

              controller.enqueue(
                encoder.encode(`event: observation\ndata: ${JSON.stringify(observation)}\n\n`)
              );
            }

            if (text && (!toolCalls || toolCalls.length === 0)) {
              // Final response
              controller.enqueue(
                encoder.encode(`event: complete\ndata: ${JSON.stringify({
                  text,
                  totalSteps: stepCount
                })}\n\n`)
              );
            }
          }
        });
        
        // Forward the stream
        for await (const chunk of result.fullStream as any) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(
              encoder.encode(`event: text\ndata: ${JSON.stringify({ text: chunk.delta || chunk.textDelta })}\n\n`)
            );
          } else if (chunk.type === 'tool-call') {
            controller.enqueue(
              encoder.encode(`event: tool\ndata: ${JSON.stringify({ 
                tool: chunk.toolName, 
                args: chunk.args 
              })}\n\n`)
            );
          } else if (chunk.type === 'tool-result') {
            controller.enqueue(
              encoder.encode(`event: tool_result\ndata: ${JSON.stringify({ 
                toolCallId: chunk.toolCallId,
                result: typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result)
              })}\n\n`)
            );
          }
        }
        
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
        controller.close();
        
      } catch (error) {
        console.error('Stream error:', error);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ 
            error: 'Stream error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`)
        );
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Handle enhanced routing stream (intent + sufficiency + rewriting)
 */
async function handleEnhancedStream(messages: CoreMessage[], userQuestion: string) {
  const encoder = new TextEncoder();

  const chatHistory: CoreMessage[] = messages.slice(0, -1).map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content
  }));

  const stream = new ReadableStream({
    async start(controller) {
      let stepCount = 0;
      let currentQuery = userQuestion;

      try {
        // Step 1: Intent Routing
        stepCount++;
        const intentResult = await intentRouter.route(userQuestion);

        controller.enqueue(
          encoder.encode(`event: intent\ndata: ${JSON.stringify({
            step: stepCount,
            intent: intentResult.primary,
            intentName: IntentRouter.getIntentName(intentResult.primary),
            strategy: intentResult.strategy,
            confidence: intentResult.confidence,
            recommendedTools: intentResult.recommendedTools,
            reasoning: intentResult.reasoning
          })}\n\n`)
        );

        // Step 2: Retrieval with potential rewrite loop
        let retrievalResults: RetrievalResult[] = [];
        let sufficient = false;
        let maxRetries = 3;

        while (!sufficient && maxRetries > 0) {
          stepCount++;
          
          controller.enqueue(
            encoder.encode(`event: retrieval\ndata: ${JSON.stringify({
              step: stepCount,
              query: currentQuery,
              attempt: 4 - maxRetries
            })}\n\n`)
          );

          // 执行增强检索
          const results = await enhancedRetrieval(currentQuery, intentResult.primary, 5);
          retrievalResults = results;

          const allDocuments = results.flatMap(r => r.documents);

          // Step 3: Sufficiency Evaluation
          if (allDocuments.length > 0) {
            stepCount++;
            const evaluation = await sufficiencyEvaluator.evaluate(
              allDocuments,
              userQuestion,
              intentResult.primary
            );

            controller.enqueue(
              encoder.encode(`event: evaluation\ndata: ${JSON.stringify({
                step: stepCount,
                sufficiency: evaluation.sufficiency,
                isSufficient: evaluation.isSufficient,
                dimensions: evaluation.dimensions,
                suggestions: evaluation.suggestions
              })}\n\n`)
            );

            sufficient = evaluation.isSufficient;

            // 如果不充分且还有重试机会
            if (!sufficient && maxRetries > 1) {
              stepCount++;
              const rewriteResult = await queryRewriter.rewrite(
                userQuestion,
                intentResult.primary,
                evaluation.missingInformation
              );

              controller.enqueue(
                encoder.encode(`event: rewrite\ndata: ${JSON.stringify({
                  step: stepCount,
                  originalQuery: userQuestion,
                  newQueries: rewriteResult.queries,
                  strategy: rewriteResult.strategy,
                  reasoning: rewriteResult.reasoning
                })}\n\n`)
              );

              // 使用改写后的查询
              currentQuery = rewriteResult.queries[1] || rewriteResult.queries[0];
            }
          }

          maxRetries--;
        }

        // Step 4: Build context and generate response
        const context = buildRetrievalContext(retrievalResults);
        
        controller.enqueue(
          encoder.encode(`event: context\ndata: ${JSON.stringify({ 
            context,
            retrieved: retrievalResults.reduce((sum, r) => sum + r.documents.length, 0),
            sources: retrievalResults.map(r => r.source)
          })}\n\n`)
        );

        // Generate final response
        const systemPrompt = createEnhancedSystemPrompt(context);
        const conversationHistory = chatHistory.length > 0
          ? chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')
          : undefined;

        const historySection = conversationHistory
          ? `\n\n**对话历史摘要：**\n${conversationHistory}\n`
          : '';

        const finalMessages: CoreMessage[] = [
          { role: 'system', content: systemPrompt + historySection },
          ...chatHistory,
          { role: 'user', content: userQuestion }
        ];

        // Build tools object
        const toolsObj: Record<string, any> = {};
        for (const tool of ALL_TOOLS) {
          toolsObj[tool.name] = {
            description: tool.description,
            parameters: tool.parameters
          };
        }

        const startTime = Date.now();
        let promptTokens = 0;
        let completionTokens = 0;

        const result = streamText({
          model: chat(getDefaultChatModelId()),
          messages: finalMessages as any,
          tools: toolsObj,
          maxToolRoundtrips: 4,
          temperature: 0.7,
          onFinish: ({ usage, finishTime }: any) => {
            promptTokens = usage?.promptTokens ?? 0;
            completionTokens = usage?.completionTokens ?? 0;
            const elapsed = finishTime ? Math.round((finishTime - startTime) / 1000) : 0;

            controller.enqueue(
              encoder.encode(`event: usage\ndata: ${JSON.stringify({
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                elapsedSeconds: elapsed
              })}\n\n`)
            );
          }
        });

        // Forward the stream
        for await (const chunk of result.fullStream as any) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(
              encoder.encode(`event: text\ndata: ${JSON.stringify({ text: chunk.delta || chunk.textDelta })}\n\n`)
            );
          } else if (chunk.type === 'tool-call') {
            controller.enqueue(
              encoder.encode(`event: tool\ndata: ${JSON.stringify({
                tool: chunk.toolName,
                args: chunk.args
              })}\n\n`)
            );
          } else if (chunk.type === 'tool-result') {
            controller.enqueue(
              encoder.encode(`event: tool_result\ndata: ${JSON.stringify({
                toolCallId: chunk.toolCallId,
                result: typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result)
              })}\n\n`)
            );
          }
        }

        controller.enqueue(
          encoder.encode(`event: complete\ndata: ${JSON.stringify({
            totalSteps: stepCount,
            intent: intentResult.primary,
            sufficient
          })}\n\n`)
        );

        controller.close();

      } catch (error) {
        console.error('Enhanced stream error:', error);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({
            error: 'Enhanced processing error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`)
        );
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Handle simple RAG chat (fallback mode)
 */
async function handleSimpleRAG(messages: CoreMessage[], userQuestion: string) {
  try {
    const context = await fetchRelevantContext(userQuestion, 5, 0.3);
    
    const systemPrompt = createEnhancedSystemPrompt(context);
    
    const enhancedMessages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    
    const result = streamText({
      model: chat(getDefaultChatModelId()),
      messages: enhancedMessages,
      temperature: 0.7
    });
    
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('RAG error:', error);
    return new Response(JSON.stringify({ 
      error: 'RAG processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET handler for checking available tools and retrieval info
 */
export async function GET() {
  const providerInfo = getCurrentProviderInfo();

  return Response.json({
    tools: ALL_TOOLS.map(t => ({
      name: t.name,
      description: t.description
    })),
    reasoning_enabled: true,
    enhanced_routing_enabled: true,
    vector_store: {
      type: providerInfo.type,
      name: providerInfo.name
    },
    hybrid_retrieval: {
      enabled: providerInfo.type === 'hybrid',
      bm25: true,
      knn: true,
      rrf_fusion: true,
      reranking: true,
      fallback_bm25_on_vectorization_error: true,
      fallback_to_rrf_on_rerank_error: true,
    },
    enhanced_features: {
      intent_routing: true,
      sufficiency_evaluation: true,
      query_rewriting: true,
      graph_retrieval: true,
      multi_source_retrieval: true
    },
    intent_types: [
      { type: 'FACTUAL', name: '事实查询', strategy: 'SINGLE_QUERY' },
      { type: 'COMPARISON', name: '对比分析', strategy: 'MULTI_QUERY' },
      { type: 'TREND', name: '趋势分析', strategy: 'MULTI_QUERY' },
      { type: 'CALCULATION', name: '计算任务', strategy: 'DIRECT_CALC' },
      { type: 'REGULATION', name: '法规咨询', strategy: 'SINGLE_QUERY' },
      { type: 'RECOMMENDATION', name: '推荐请求', strategy: 'MULTI_QUERY' },
      { type: 'GENERAL', name: '通用对话', strategy: 'SINGLE_QUERY' }
    ],
    features: [
      'ReAct思维链',
      '多轮推理',
      '混合检索 (BM25 + kNN)',
      'RRF 排名融合',
      '智能重排',
      '意图路由',
      '充分性评估',
      '查询改写重试',
      '图谱检索',
      '多源检索',
      '知识库查询',
      '运费计算',
      '法规查询',
      '利润估算',
      '关键词生成'
    ]
  });
}
