/**
 * Chat API Route with ReAct Agent - Enhanced Version
 * 
 * Implements ReAct (Reasoning + Acting) paradigm with:
 * - Extended tool support (shipping, regulations, profit, etc.)
 * - Improved error handling
 * - Streaming reasoning steps
 * - Conversation memory support
 */

import { CoreMessage } from 'ai';
import { streamText, generateText } from 'ai';
import {
  getChatProvider,
  getDefaultChatModelId,
  getEmbeddingProvider,
  getEmbeddingModelId,
} from '@/lib/openai';
import { createClient } from '@supabase/supabase-js';
import { AGENT_TOOLS } from '@/lib/react-agent';
import { EXTENDED_TOOLS, executeExtendedTool } from '@/lib/extended-tools';
import { createConversationMemory, ConversationMemoryManager } from '@/lib/conversation-memory';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_KEY ?? ""
);

const chat = getChatProvider();
const embedClient = getEmbeddingProvider();

// Combine all tools
const ALL_TOOLS = [...AGENT_TOOLS, ...EXTENDED_TOOLS];

/**
 * Generate embedding for a query
 */
async function generateEmbedding(message: string) {
  const { embed } = await import('ai');
  return embed({
    model: embedClient.embedding(getEmbeddingModelId()),
    value: message
  });
}

/**
 * Query the vector database for relevant context
 */
async function fetchRelevantContext(
  embedding: number[],
  matchCount: number = 5,
  threshold: number = 0.3
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_relevant_carchunks", {
      query_vector: embedding,
      match_threshold: threshold,
      match_count: matchCount
    });

    if (error) {
      console.error('Vector DB error:', error);
      return '知识库查询失败，使用通用知识回答。';
    }

    if (!data || data.length === 0) {
      return '知识库中没有找到相关信息。';
    }

    return data.map((item: any) => `
      Source: ${item.url}
      Date Updated: ${item.date_updated}
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

    const { embedding } = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('get_relevant_carchunks', {
      query_vector: embedding,
      match_threshold: threshold,
      match_count: topK
    });

    if (error) {
      return `查询失败: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return '未找到相关信息。';
    }

    return JSON.stringify(data.map((item: any) => ({
      source: item.url,
      date: item.date_updated,
      content: item.content
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
    const { embedding } = await generateEmbedding(`${category} ${market} trending bestseller`);
    
    const { data } = await supabase.rpc('get_relevant_carchunks', {
      query_vector: embedding,
      match_threshold: 0.25,
      match_count: 8
    });
    
    return JSON.stringify({
      category,
      market,
      trends_found: data?.length || 0,
      data: data || []
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
    const { embedding } = await generateEmbedding(productIds.join(' '));
    
    const { data } = await supabase.rpc('get_relevant_carchunks', {
      query_vector: embedding,
      match_threshold: 0.2,
      match_count: 10
    });
    
    return JSON.stringify({
      products_found: data?.length || 0,
      data: data || []
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
    const { embedding } = await generateEmbedding(topic);
    
    const { data } = await supabase.rpc('get_relevant_carchunks', {
      query_vector: embedding,
      match_threshold: 0.3,
      match_count: 5
    });
    
    return JSON.stringify({
      topic,
      summary_points: data?.map((item: any) => ({
        source: item.url,
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

**ReAct 思维链：**
遇到复杂问题时，请采用以下步骤：
1. 思考：用户需要什么信息？
2. 行动：调用合适的工具获取数据
3. 观察：分析工具返回的结果
4. 推理：基于结果判断是否需要更多信息
5. 回答：信息充分时提供完整解答

**可用工具：**
- query_vector_db: 查询知识库获取网站内容
- analyze_trends: 分析产品趋势和爆款潜力
- compare_products: 对比多个产品
- summarize_knowledge: 获取主题概述
- calculate_shipping: 计算运费和物流方案
- check_regulations: 检查目标市场法规
- analyze_listing: 分析和优化产品 Listing
- estimate_profit: 计算利润和成本
- generate_keywords: 生成 SEO 关键词
- compare_packaging: 比较包装方案

**回答规范：**
1. 优先使用知识库数据，其次使用工具计算
2. 引用来源时说明 URL 和更新日期
3. 不编造具体数字，基于实际数据
4. 使用中文，Markdown 格式
5. 涉及法规政策时，建议咨询专业机构
${historySection}

**上下文信息：**
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
    const { messages, useReasoning = true } = await req.json();
    
    const latestMessage = messages.at(-1);
    if (!latestMessage || latestMessage.role !== 'user') {
      return new Response('Invalid request: no user message', { status: 400 });
    }
    
    const userQuestion = latestMessage.content;
    
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
        // Fetch context
        const { embedding } = await generateEmbedding(userQuestion);
        const context = await fetchRelevantContext(embedding, 5, 0.35);
        
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
        
        // Stream response
        const result = streamText({
          model: chat(getDefaultChatModelId()),
          messages: enhancedMessages,
          tools: toolsObj,
          maxToolRoundtrips: 6,
          temperature: 0.7,
          onStepFinish: async ({ step, toolCalls, text, toolResults }) => {
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
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(
              encoder.encode(`event: text\ndata: ${JSON.stringify({ text: chunk.delta })}\n\n`)
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
 * Handle simple RAG chat (fallback mode)
 */
async function handleSimpleRAG(messages: CoreMessage[], userQuestion: string) {
  try {
    const { embedding } = await generateEmbedding(userQuestion);
    const context = await fetchRelevantContext(embedding, 5, 0.3);
    
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
 * GET handler for checking available tools
 */
export async function GET() {
  return Response.json({
    tools: ALL_TOOLS.map(t => ({
      name: t.name,
      description: t.description
    })),
    reasoning_enabled: true,
    features: [
      'ReAct思维链',
      '多轮推理',
      '知识库查询',
      '运费计算',
      '法规查询',
      '利润估算',
      '关键词生成'
    ]
  });
}
