/**
 * Conversation Memory Manager
 * 
 * Manages conversation history with intelligent summarization
 * to maintain context across long multi-turn conversations.
 */

import { CoreMessage } from 'ai';

/**
 * Configuration for conversation memory
 */
export interface MemoryConfig {
  maxMessages: number;        // Maximum messages to keep in full
  summaryThreshold: number;   // When to trigger summarization (in messages)
  maxSummaryLength: number;  // Maximum length of summary
}

/**
 * Conversation memory state
 */
export interface ConversationMemory {
  messages: CoreMessage[];
  summary: string | null;
  messageCount: number;
  lastSummarizedAt: number;
}

/**
 * Default configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxMessages: 20,
  summaryThreshold: 10,
  maxSummaryLength: 500
};

/**
 * Message importance scoring for deciding what to keep
 */
function scoreMessageImportance(message: CoreMessage): number {
  const content = message.content as string;
  
  // Tool results are less important
  if (message.role === 'tool') {
    // Keep only short tool results
    return content.length < 200 ? 2 : 0;
  }
  
  // User messages with new topics are important
  if (message.role === 'user') {
    const importantKeywords = ['分析', '对比', '推荐', '建议', '比较', '总结', 'trend', 'compare', 'recommend'];
    const hasImportantKeyword = importantKeywords.some(kw => content.includes(kw));
    return hasImportantKeyword ? 5 : 3;
  }
  
  // Assistant responses with code or structured data are important
  if (message.role === 'assistant') {
    const hasCode = content.includes('```') || content.includes('```json');
    const hasStructure = content.includes('## ') || content.includes('**');
    return (hasCode ? 3 : 0) + (hasStructure ? 2 : 0);
  }
  
  return 1;
}

/**
 * Extract key points from messages for summarization
 */
function extractKeyPoints(messages: CoreMessage[]): string[] {
  const points: string[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = msg.content as string;
      // Extract first sentence or question
      const firstLine = content.split('\n')[0];
      if (firstLine.length < 100) {
        points.push(`用户问: ${firstLine}`);
      }
    } else if (msg.role === 'assistant') {
      const content = msg.content as string;
      // Extract headers or key conclusions
      const headers = content.match(/^#{1,3}\s+(.+)$/gm);
      if (headers) {
        headers.forEach(h => points.push(h.replace(/^#+\s+/, '')));
      }
      // Extract bold important points
      const boldPoints = content.match(/\*\*(.+?)\*\*/g);
      if (boldPoints && boldPoints.length > 0) {
        points.push(...boldPoints.slice(0, 2).map(p => p.replace(/\*\*/g, '')));
      }
    }
  }
  
  return points.slice(-10); // Keep last 10 points
}

/**
 * Create a summary prompt for the LLM
 */
function createSummaryPrompt(messages: CoreMessage[], maxLength: number): string {
  const recentMessages = messages.slice(-15).map((msg, i) => {
    const role = msg.role === 'user' ? '用户' : '助手';
    const content = (msg.content as string).substring(0, 300);
    return `[${i + 1}] ${role}: ${content}${content.length >= 300 ? '...' : ''}`;
  }).join('\n');
  
  return `请为以下对话创建一个简洁的摘要，保留关键信息和上下文（不超过${maxLength}字符）：

${recentMessages}

摘要格式：
- 讨论主题：
- 关键信息：
- 用户意图：
`;
}

/**
 * Conversation Memory Manager Class
 */
export class ConversationMemoryManager {
  private config: MemoryConfig;
  private memory: ConversationMemory;
  private summarizeFn: ((prompt: string) => Promise<string>) | null = null;
  
  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.memory = {
      messages: [],
      summary: null,
      messageCount: 0,
      lastSummarizedAt: Date.now()
    };
  }
  
  /**
   * Set the summarization function (requires LLM)
   */
  setSummarizer(summarizeFn: (prompt: string) => Promise<string>): void {
    this.summarizeFn = summarizeFn;
  }
  
  /**
   * Add a message to memory
   */
  addMessage(message: CoreMessage): void {
    // Don't add tool messages to main memory (they're in the message content)
    if (message.role === 'tool') {
      return;
    }
    
    this.memory.messages.push(message);
    this.memory.messageCount++;
    
    // Check if we need to summarize
    if (this.shouldSummarize()) {
      this.triggerSummarization();
    }
  }
  
  /**
   * Check if summarization should be triggered
   */
  private shouldSummarize(): boolean {
    return (
      this.memory.messages.length >= this.config.summaryThreshold &&
      this.summarizeFn !== null
    );
  }
  
  /**
   * Trigger summarization process
   */
  private async triggerSummarization(): Promise<void> {
    if (!this.summarizeFn) return;
    
    try {
      const prompt = createSummaryPrompt(this.memory.messages, this.config.maxSummaryLength);
      const summary = await this.summarizeFn(prompt);
      
      this.memory.summary = summary;
      this.memory.lastSummarizedAt = Date.now();
      
      // Keep only recent messages, remove older ones
      const keepCount = Math.floor(this.config.maxMessages / 2);
      this.memory.messages = this.memory.messages.slice(-keepCount);
      
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
      // Fallback: just trim messages
      this.memory.messages = this.memory.messages.slice(-this.config.maxMessages);
    }
  }
  
  /**
   * Get messages for context (with optional summary prefix)
   */
  getContextMessages(): CoreMessage[] {
    const messages: CoreMessage[] = [];
    
    // Add summary as system context if available
    if (this.memory.summary) {
      messages.push({
        role: 'system',
        content: `【对话历史摘要】\n${this.memory.summary}\n\n基于以上摘要，继续回答用户的新问题。`
      });
    }
    
    // Add recent messages
    messages.push(...this.memory.messages.slice(-this.config.maxMessages));
    
    return messages;
  }
  
  /**
   * Get the current memory state
   */
  getState(): ConversationMemory {
    return { ...this.memory };
  }
  
  /**
   * Clear all memory
   */
  clear(): void {
    this.memory = {
      messages: [],
      summary: null,
      messageCount: 0,
      lastSummarizedAt: Date.now()
    };
  }
  
  /**
   * Get key points from conversation
   */
  getKeyPoints(): string[] {
    return extractKeyPoints(this.memory.messages);
  }
  
  /**
   * Export memory for debugging
   */
  export(): string {
    return JSON.stringify({
      messageCount: this.memory.messageCount,
      summaryLength: this.memory.summary?.length || 0,
      lastSummarizedAt: new Date(this.memory.lastSummarizedAt).toISOString(),
      messages: this.memory.messages.map(m => ({
        role: m.role,
        contentPreview: String(m.content).substring(0, 100)
      }))
    }, null, 2);
  }
}

/**
 * Factory function to create a memory manager
 */
export function createConversationMemory(
  config?: Partial<MemoryConfig>
): ConversationMemoryManager {
  return new ConversationMemoryManager(config);
}

/**
 * Session storage adapter for persisting memory
 */
export interface MemoryStorage {
  save(key: string, data: ConversationMemory): Promise<void>;
  load(key: string): Promise<ConversationMemory | null>;
  delete(key: string): Promise<void>;
}

/**
 * In-memory storage implementation
 */
export class InMemoryStorage implements MemoryStorage {
  private store: Map<string, ConversationMemory> = new Map();
  
  async save(key: string, data: ConversationMemory): Promise<void> {
    this.store.set(key, { ...data });
  }
  
  async load(key: string): Promise<ConversationMemory | null> {
    const data = this.store.get(key);
    return data ? { ...data } : null;
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Session storage implementation using localStorage
 */
export class SessionStorageAdapter implements MemoryStorage {
  private prefix = 'chatofun_memory_';
  
  async save(key: string, data: ConversationMemory): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save memory:', e);
    }
  }
  
  async load(key: string): Promise<ConversationMemory | null> {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(this.prefix + key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load memory:', e);
      return null;
    }
  }
  
  async delete(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.prefix + key);
  }
}
