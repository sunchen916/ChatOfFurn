/**
 * ReAct Agent Implementation for ChaTofFun
 * 
 * ReAct = Reasoning + Acting
 * This agent can think step-by-step, use tools, observe results,
 * and continue reasoning until it reaches a conclusion.
 */

import { generateText, CoreMessage } from 'ai';
import { getChatProvider, getDefaultChatModelId } from './openai';
import { querySimilarDocuments } from './vector-store';
import { executeWebSearchTool } from './web-search-tools';

// Types for ReAct agent
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ReasoningStep {
  step: number;
  thought: string;
  action: string | null;
  observation: string | null;
  isFinal: boolean;
}

export interface AgentConfig {
  maxIterations?: number;
  verbose?: boolean;
}

// Tool definitions for the agent (基础工具 + 网络搜索工具)
export const AGENT_TOOLS: Tool[] = [
  // 基础工具 - 向量数据库相关
  {
    name: 'query_vector_db',
    description: 'Query the vector database for relevant information from the furniture website knowledge base. Use this when you need specific details about products, policies, shipping, materials, or any content from the website.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant information in the knowledge base'
        },
        top_k: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)'
        },
        threshold: {
          type: 'number',
          description: 'Similarity threshold (0-1, default: 0.3)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'analyze_trends',
    description: 'Analyze product trends and identify potential bestsellers based on the website content. Use this when the user asks about trending products or which items might become bestsellers.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Product category to analyze (e.g., "sofa", "table", "chair")'
        },
        market: {
          type: 'string',
          description: 'Target market (e.g., "North America", "Europe")'
        }
      },
      required: []
    }
  },
  {
    name: 'compare_products',
    description: 'Compare multiple products from the knowledge base. Use this when user wants to compare features, prices, materials, or other attributes of different products.',
    parameters: {
      type: 'object',
      properties: {
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of product identifiers or keywords to compare'
        },
        comparison_aspects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Aspects to compare (e.g., ["material", "price", "shipping"])'
        }
      },
      required: ['product_ids']
    }
  },
  {
    name: 'summarize_knowledge',
    description: 'Get a comprehensive summary of a specific topic from the knowledge base. Use this when you need to provide an overview or background information before diving into specifics.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The topic to summarize (e.g., "shipping policies", "material certifications")'
        }
      },
      required: ['topic']
    }
  },
  // 网络搜索工具
  {
    name: 'search_furniture_price',
    description: 'Search for furniture prices on major e-commerce platforms (Amazon, Wayfair, IKEA, etc.). Use when user wants to know current market prices for specific furniture items, wants price comparison, or needs pricing data for business decisions.',
    parameters: {
      type: 'object',
      properties: {
        product_name: {
          type: 'string',
          description: 'The furniture product to search for (e.g., "modern leather sofa", "oak dining table", "ergonomic office chair")'
        },
        platform: {
          type: 'string',
          description: 'Specific platform to search (options: "amazon", "wayfair", "ikea", "all"). Default: "all"'
        },
        price_range_min: {
          type: 'number',
          description: 'Minimum price filter in USD'
        },
        price_range_max: {
          type: 'number',
          description: 'Maximum price filter in USD'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        }
      },
      required: ['product_name']
    }
  },
  {
    name: 'get_trending_furniture',
    description: 'Get trending/popular furniture items from various sources. Use when user asks about trending furniture, hot products, bestsellers, or wants to know what furniture styles/products are popular right now.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Furniture category to filter (options: "living_room", "bedroom", "dining", "office", "outdoor", "all"). Default: "all"'
        },
        source: {
          type: 'string',
          description: 'Data source (options: "amazon", "google_trends", "pinterest", "all"). Default: "all"'
        },
        timeframe: {
          type: 'string',
          description: 'Time period (options: "day", "week", "month", "year"). Default: "month"'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of trending items to return (default: 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'search_market_trends',
    description: 'Search for furniture market trends and industry insights. Use when user wants to understand market direction, emerging furniture styles, consumer preferences, or industry news.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Trend topic to search (e.g., "sustainable furniture", "smart home furniture", "minimalist design trends")'
        },
        region: {
          type: 'string',
          description: 'Geographic region for trends (options: "usa", "europe", "asia", "global"). Default: "global"'
        },
        include_reports: {
          type: 'boolean',
          description: 'Include market report summaries if available (default: true)'
        }
      },
      required: ['topic']
    }
  },
  {
    name: 'get_bestseller_analysis',
    description: 'Get bestseller analysis and insights for specific furniture categories. Use when user wants to know what makes furniture items bestsellers, wants competitive analysis, or needs product selection recommendations.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Furniture category to analyze (e.g., "sofa", "dining_table", "office_chair")'
        },
        marketplace: {
          type: 'string',
          description: 'Marketplace to analyze (options: "amazon", "wayfair", "etsy", "all"). Default: "amazon"'
        },
        include_reviews: {
          type: 'boolean',
          description: 'Include top customer review insights (default: false)'
        }
      },
      required: ['category']
    }
  },
  {
    name: 'compare_marketplace_prices',
    description: 'Compare the same or similar furniture products across multiple e-commerce platforms. Use when user wants to compare prices for a specific product across Amazon, Wayfair, Walmart, etc.',
    parameters: {
      type: 'object',
      properties: {
        product_keywords: {
          type: 'string',
          description: 'Product name or keywords to search across platforms'
        },
        marketplaces: {
          type: 'array',
          items: { type: 'string' },
          description: 'Marketplaces to compare (e.g., ["amazon", "wayfair", "walmart", "target"]). Default: ["amazon", "wayfair"]'
        }
      },
      required: ['product_keywords']
    }
  }
];

// System prompt for ReAct agent
const REACT_SYSTEM_PROMPT = `You are ChaTofFun, an expert AI assistant specialized in foreign trade furniture e-commerce operations.

**Your Core Capabilities:**
- Product selection and trend analysis (using real-time web search)
- Listing optimization and copywriting
- Material and craftsmanship expertise
- Cross-border logistics and packaging
- Website operations and policy consulting
- Real-time market price research (via web search)
- Trending product identification (via Google Trends, Amazon Bestsellers, Pinterest)

**Web Search Features:**
You have access to powerful web search capabilities that allow you to:
- Search real-time furniture prices across major e-commerce platforms
- Identify trending and popular furniture styles/products
- Analyze market trends and consumer preferences
- Compare prices across different marketplaces
- Get bestseller insights and competitive analysis

**Your Thinking Process (ReAct Paradigm):**
You follow the ReAct (Reasoning + Acting) paradigm to solve complex problems:

1. **Thought**: Analyze the user's question and decide what information you need
2. **Action**: Choose the appropriate tool to gather information (use web search tools for real-time data)
3. **Observation**: Review the results from your action
4. **Reason**: Based on observations, determine next steps or conclude

**Response Format:**
For each step, respond with a JSON object containing:
- "thought": Your reasoning about what to do next
- "action": The tool name and parameters (if needed), or "final_answer" if done
- "observation": The result from the tool (or null if no action taken)

When you have enough information to provide a comprehensive answer, respond with:
{
  "thought": "I now have sufficient information to answer the user's question.",
  "action": "final_answer",
  "observation": null
}

Then in your next message, provide the complete, well-structured answer.

**Important Rules:**
1. Always use tools when you need specific information from the knowledge base
2. Be precise in your queries - the more specific, the better the results
3. Combine information from multiple sources when needed
4. Be honest about information gaps - if you don't have enough data, say so
5. Use Chinese for responses, Markdown for formatting
6. When citing information, reference the source URL and date
7. Never fabricate specific sales numbers - base claims on actual page content
8. For price-related questions, use web search tools to get real-time data

**Tools Available:**
- query_vector_db: Search the knowledge base for specific information
- analyze_trends: Identify trending products and bestsellers
- compare_products: Compare multiple products side by side
- summarize_knowledge: Get an overview of a topic

**Web Search Tools:**
- search_furniture_price: Search for furniture prices on Amazon, Wayfair, IKEA, etc. Use this when user asks about market prices, pricing research, or competitive pricing analysis.
- get_trending_furniture: Get trending/popular furniture from Google Trends, Amazon Bestsellers, Pinterest. Use when user asks about trending furniture, hot products, or popular styles.
- search_market_trends: Search for furniture market trends and industry insights. Use when user wants market analysis, industry news, or consumer preference trends.
- get_bestseller_analysis: Get bestseller analysis and insights. Use when user wants competitive analysis or product selection recommendations.
- compare_marketplace_prices: Compare prices across multiple e-commerce platforms. Use when user wants price comparison shopping.

Always start by thinking about what information you need, then take action to gather it.`

// Chroma client for vector DB (imported from chroma.ts module)

/**
 * Execute a tool by name with given parameters
 */
async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  
  switch (toolName) {
    case 'query_vector_db': {
      const query = params.query as string;
      const topK = (params.top_k as number) || 5;
      const threshold = (params.threshold as number) || 0.3;
      
      // Query Supabase/MySQL knowledge base
      const results = await querySimilarDocuments(query, topK, threshold);
      
      if (!results || results.length === 0) {
        return 'No relevant information found in the knowledge base.';
      }
      
      // Format results - supabase-kb returns similarity (0-1, higher is better)
      const filteredResults = results.filter(item => {
        const similarity = item.similarity || 0;
        return similarity >= threshold;
      });
      
      if (filteredResults.length === 0) {
        return 'No relevant information found above the similarity threshold.';
      }
      
      // Format results
      const formattedResults = filteredResults.map((item) => ({
        source: item.metadata?.url || item.id,
        date: item.metadata?.createdAt,
        content: item.content,
        similarity: item.similarity
      }));
      
      return JSON.stringify(formattedResults, null, 2);
    }
    
    case 'analyze_trends': {
      const category = params.category as string || '';
      const market = params.market as string || '';
      
      // Query for relevant trend information
      const query = `${category} ${market} trending bestseller popular`.trim();
      const results = await querySimilarDocuments(query, 8, 0.1);
      
      if (!results || results.length === 0) {
        return 'No trend data available in the knowledge base.';
      }
      
      // Analyze and summarize trends
      const trends = results
        .filter((item) => item.content)
        .map((item) => ({
          source: item.metadata?.url || item.id,
          insights: item.content
        }));
      
      return JSON.stringify(trends, null, 2);
    }
    
    case 'compare_products': {
      const productIds = params.product_ids as string[];
      const aspects = params.comparison_aspects as string[] || ['material', 'price', 'features'];
      
      // Query for each product
      const combinedQuery = productIds.join(' ');
      const results = await querySimilarDocuments(combinedQuery, 10, 0.1);
      
      return JSON.stringify({
        products_found: results?.length || 0,
        data: results || [],
        comparison_aspects: aspects
      }, null, 2);
    }
    
    case 'summarize_knowledge': {
      const topic = params.topic as string;
      
      const results = await querySimilarDocuments(topic, 5, 0.1);
      
      return JSON.stringify({
        topic,
        summary_points: results?.map((item) => ({
          source: item.metadata?.url || item.id,
          content: item.content
        })) || []
      }, null, 2);
    }
    
    // 网络搜索工具
    case 'search_furniture_price':
    case 'get_trending_furniture':
    case 'search_market_trends':
    case 'get_bestseller_analysis':
    case 'compare_marketplace_prices': {
      return await executeWebSearchTool(toolName, params);
    }
    
    default:
      return `Unknown tool: ${toolName}`;
  }
}

/**
 * Main ReAct Agent class
 */
export class ReActAgent {
  private model;
  private maxIterations: number;
  private verbose: boolean;
  
  constructor(config: AgentConfig = {}) {
    this.model = getChatProvider()(getDefaultChatModelId());
    this.maxIterations = config.maxIterations || 10;
    this.verbose = config.verbose || false;
  }
  
  /**
   * Generate tools configuration for AI SDK
   */
  private getToolsConfig(): Record<string, any> {
    return {
      query_vector_db: {
        description: AGENT_TOOLS[0].description,
        parameters: AGENT_TOOLS[0].parameters
      },
      analyze_trends: {
        description: AGENT_TOOLS[1].description,
        parameters: AGENT_TOOLS[1].parameters
      },
      compare_products: {
        description: AGENT_TOOLS[2].description,
        parameters: AGENT_TOOLS[2].parameters
      },
      summarize_knowledge: {
        description: AGENT_TOOLS[3].description,
        parameters: AGENT_TOOLS[3].parameters
      },
      search_furniture_price: {
        description: AGENT_TOOLS[4].description,
        parameters: AGENT_TOOLS[4].parameters
      },
      get_trending_furniture: {
        description: AGENT_TOOLS[5].description,
        parameters: AGENT_TOOLS[5].parameters
      },
      search_market_trends: {
        description: AGENT_TOOLS[6].description,
        parameters: AGENT_TOOLS[6].parameters
      },
      get_bestseller_analysis: {
        description: AGENT_TOOLS[7].description,
        parameters: AGENT_TOOLS[7].parameters
      },
      compare_marketplace_prices: {
        description: AGENT_TOOLS[8].description,
        parameters: AGENT_TOOLS[8].parameters
      }
    };
  }
  
  /**
   * Run the ReAct agent with a user query
   * Returns both the reasoning steps and final response
   */
  async run(userMessage: string, chatHistory: CoreMessage[] = []): Promise<{
    reasoningSteps: ReasoningStep[];
    finalResponse: string;
  }> {
    const reasoningSteps: ReasoningStep[] = [];
    let step = 0;
    let isComplete = false;
    
    // Build the conversation with system prompt
    const messages: CoreMessage[] = [
      { role: 'system', content: REACT_SYSTEM_PROMPT },
      ...chatHistory,
      { role: 'user', content: userMessage }
    ];
    
    if (this.verbose) {
      console.log('Starting ReAct agent with user message:', userMessage);
    }
    
    while (!isComplete && step < this.maxIterations) {
      step++;
      
      // Get LLM response
      const response = await generateText({
        model: this.model,
        messages,
        tools: this.getToolsConfig(),
        maxSteps: 3
      });
      
      // Process tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.toolName;
          const toolArgs = toolCall.args as Record<string, unknown>;
          
          if (this.verbose) {
            console.log(`Step ${step}: Calling tool ${toolName}`, toolArgs);
          }
          
          // Add thought about the action
          reasoningSteps.push({
            step,
            thought: `需要调用 ${toolName} 工具来获取信息`,
            action: `${toolName}(${JSON.stringify(toolArgs)})`,
            observation: null,
            isFinal: false
          });
          
          // Execute the tool
          const observation = await executeTool(toolName, toolArgs);
          
          if (this.verbose) {
            console.log(`Step ${step}: Tool result:`, observation.substring(0, 100));
          }
          
          // Update the step with observation
          const currentStep = reasoningSteps[reasoningSteps.length - 1];
          currentStep.observation = observation.length > 2000 
            ? observation.substring(0, 2000) + '...[内容已截断]' 
            : observation;
          
          // Add tool result to messages
          messages.push({
            role: 'assistant',
            content: response.text
          } as CoreMessage);
          
          messages.push({
            role: 'tool',
            content: JSON.stringify({ [toolName]: observation }),
            toolCallId: toolCall.toolCallId
          } as unknown as CoreMessage);
        }
        
        // Check if we have a final answer
        const lastResponse = response.text.toLowerCase();
        if (lastResponse.includes('final_answer') || 
            lastResponse.includes('完整回答') ||
            lastResponse.includes('结论') ||
            step >= this.maxIterations) {
          isComplete = true;
          
          reasoningSteps.push({
            step: step + 1,
            thought: '已收集足够信息，准备给出最终回答',
            action: null,
            observation: null,
            isFinal: true
          });
        }
      } else {
        // No tool calls, check if it's a final response
        const content = response.text;
        
        if (this.verbose) {
          console.log(`Step ${step}: Final response received`);
        }
        
        reasoningSteps.push({
          step,
          thought: '已获得最终回答',
          action: null,
          observation: null,
          isFinal: true
        });
        
        isComplete = true;
        
        return {
          reasoningSteps,
          finalResponse: content
        };
      }
    }
    
    // If we exited loop without completing, return what we have
    return {
      reasoningSteps,
      finalResponse: '抱歉，我需要更多时间来思考这个问题。或者你可以尝试更具体地描述你的问题。'
    };
  }
  
  /**
   * Stream the agent response with reasoning steps
   */
  async *runStream(userMessage: string, chatHistory: CoreMessage[] = []) {
    const reasoningSteps: ReasoningStep[] = [];
    let step = 0;
    
    const messages: CoreMessage[] = [
      { role: 'system', content: REACT_SYSTEM_PROMPT },
      ...chatHistory,
      { role: 'user', content: userMessage }
    ];
    
    yield { type: 'start' as const, reasoningSteps };
    
    while (step < this.maxIterations) {
      step++;
      
      const response = await generateText({
        model: this.model,
        messages,
        tools: this.getToolsConfig(),
        maxSteps: 3
      });
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.toolName;
          const toolArgs = toolCall.args as Record<string, unknown>;
          
          // Yield thinking step
          yield {
            type: 'thinking' as const,
            step,
            thought: `需要调用 ${toolName} 工具`,
            tool: toolName,
            params: toolArgs
          };
          
          // Execute tool
          const observation = await executeTool(toolName, toolArgs);
          
          reasoningSteps.push({
            step,
            thought: `调用 ${toolName} 工具获取信息`,
            action: `${toolName}(${JSON.stringify(toolArgs)})`,
            observation: observation.length > 2000 ? observation.substring(0, 2000) + '...[截断]' : observation,
            isFinal: false
          });
          
          yield {
            type: 'observation' as const,
            step,
            observation: observation.length > 2000 ? observation.substring(0, 500) + '...[更多内容]' : observation
          };
          
          messages.push({
            role: 'assistant',
            content: response.text
          } as CoreMessage);
          
          messages.push({
            role: 'tool',
            content: JSON.stringify({ [toolName]: observation }),
            toolCallId: toolCall.toolCallId
          } as unknown as CoreMessage);
        }
        
        if (step >= this.maxIterations) {
          yield { type: 'complete' as const, reasoningSteps, finalResponse: '已达到最大推理步数' };
          return;
        }
      } else {
        // Final response
        yield { type: 'complete' as const, reasoningSteps, finalResponse: response.text };
        return;
      }
    }
    
    yield { type: 'complete' as const, reasoningSteps, finalResponse: '推理超时' };
  }
}

/**
 * Simple factory function to create a ReAct agent
 */
export function createReActAgent(config?: AgentConfig): ReActAgent {
  return new ReActAgent(config);
}
