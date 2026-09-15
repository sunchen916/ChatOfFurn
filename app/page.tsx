/**
 * Home Page - ChaTofFun AI Assistant with ReAct Reasoning
 * 
 * Enhanced version with improved reasoning visualization and
 * extended tool support.
 */

"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import ChatOutput from '@/components/ChatOutput';
import ChatInput from '@/components/ChatInput';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import Link from 'next/link';
import ReasoningSteps, { ReasoningBadge, ToolCallToast, MiniReasoningIndicator, ReasoningStep } from '@/components/EnhancedReasoning';
import { Brain, Sparkles, Zap, Settings, Info, ChevronDown, History, Trash2 } from 'lucide-react';

export default function Home() {
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [activeToolCalls, setActiveToolCalls] = useState<Array<{ name: string; args: Record<string, unknown> }>>([]);
  const [showReasoning, setShowReasoning] = useState(true);
  const [context, setContext] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);

  const {
    input,
    messages,
    status,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading
  } = useChat({
    api: '/api/chat',
    body: {
      useReasoning: true
    },
    onResponse: (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      const processBuffer = () => {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.context) {
                setContext(data.context);
              }
              
              if (data.step !== undefined) {
                setReasoningSteps(prev => {
                  const existing = prev.findIndex(s => s.step === data.step);
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = {
                      step: data.step,
                      thought: data.thought || prev[existing].thought,
                      action: data.action || prev[existing].action,
                      observation: data.observation || prev[existing].observation,
                      isFinal: data.isFinal || false,
                      toolName: data.toolName,
                      toolParams: data.toolParams
                    };
                    return updated;
                  }
                  return [...prev, {
                    step: data.step,
                    thought: data.thought || '思考中...',
                    action: data.action || null,
                    observation: data.observation || null,
                    isFinal: data.isFinal || false,
                    toolName: data.toolName,
                    toolParams: data.toolParams
                  }];
                });
              }
              
              if (data.toolCalls) {
                setActiveToolCalls(data.toolCalls);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      };

      const readStream = async () => {
        try {
          let result;
          do {
            result = await reader.read();
            if (!result.done) {
              buffer += decoder.decode(result.value, { stream: true });
              processBuffer();
            }
          } while (!result.done);
          
          if (buffer) processBuffer();
        } catch (e) {
          console.error('Stream reading error:', e);
        }
      };

      readStream();
    },
    onFinish: () => {
      setConversationCount(prev => prev + 1);
      setTimeout(() => {
        setReasoningSteps([]);
        setActiveToolCalls([]);
        setContext('');
      }, 5000);
    },
    onError: () => {
      setReasoningSteps([]);
      setActiveToolCalls([]);
    }
  });

  // Clear reasoning steps when status changes
  useEffect(() => {
    if (status === 'ready') {
      // Keep last reasoning steps visible briefly
    }
  }, [status]);

  const suggestions = [
    { 
      icon: '📊',
      text: '北美客厅家具材质与价位带',
      query: '北美客厅家具常见材质与价位带怎么定？'
    },
    { 
      icon: '📝',
      text: 'Listing 卖点排序',
      query: '独立站 Listing 卖点怎么排序更利于转化？'
    },
    { 
      icon: '📦',
      text: '平板包装出口欧洲',
      query: '平板包装沙发出口欧洲要注意什么？'
    },
    { 
      icon: '🔥',
      text: '提炼爆款方向',
      query: '如何从现有 SKU 提炼下一季爆款方向？'
    },
    { 
      icon: '💰',
      text: '利润率计算',
      query: '这款产品成本50美元，售价150美元，能赚多少？'
    },
    { 
      icon: '🔍',
      text: '法规认证咨询',
      query: '出口到美国的实木家具需要哪些认证？'
    },
  ];

  const onSuggestionClick = (query: string) => {
    handleInputChange({ target: { value: query } } as any);
  };

  const clearChat = () => {
    setMessages([]);
    setReasoningSteps([]);
    setConversationCount(0);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo */}
            <div className="min-w-0">
              <h1
                className="text-2xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))",
                }}
              >
                🪑 ChaTofFun
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  外贸家具站点运营与选品助手
                </p>
                {reasoningSteps.length > 0 && (
                  <ReasoningBadge count={reasoningSteps.length} />
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* ReAct Toggle */}
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
                  showReasoning 
                    ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400' 
                    : 'bg-white/70 dark:bg-gray-800/70 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
                title={showReasoning ? '关闭思维链显示' : '开启思维链显示'}
              >
                <Brain className={`w-3.5 h-3.5 ${showReasoning ? '' : 'opacity-50'}`} />
                <span className="hidden sm:inline">思维链</span>
              </button>

              {/* Clear Chat */}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="清空对话"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* History Toggle */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-xl transition-colors ${
                  showHistory 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title="对话历史"
              >
                <History className="w-4 h-4" />
              </button>

              <Link
                href="/car-match"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200
                  bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm hover:shadow-md"
                style={{
                  borderColor: 'hsl(var(--theme-primary) / 0.35)',
                  color: 'hsl(var(--theme-primary))',
                }}
              >
                🪑 <span className="hidden sm:inline">选品助手</span>
              </Link>
              <ThemeSwitcher />
            </div>
          </div>
        </div>

        {/* Mini Reasoning Indicator */}
        {(status === 'submitted' || status === 'streaming') && showReasoning && reasoningSteps.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 pb-2">
            <MiniReasoningIndicator steps={reasoningSteps} isActive={status === 'submitted'} />
          </div>
        )}

        {/* Announcement Bar */}
        <div
          className="overflow-hidden border-t border-gray-200/60 dark:border-gray-700/60"
          style={{ backgroundColor: 'hsl(var(--theme-primary) / 0.06)' }}
        >
          <div className="max-w-4xl mx-auto px-4">
            <div
              className="whitespace-nowrap py-1 text-sm animate-marquee"
              style={{ color: 'hsl(var(--theme-primary))' }}
            >
              ✨ ChaTofFun 已支持 ReAct 思维链 - 可以展示 AI 的完整推理过程！新功能：运费计算、法规查询、利润估算等工具已上线！
            </div>
          </div>
        </div>
      </div>

      {/* ── Chat Container ── */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <div
          className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 h-[calc(100vh-220px)] flex flex-col"
          style={{ boxShadow: '0 8px 40px hsl(var(--theme-primary) / 0.08)' }}
        >
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Reasoning Steps (top of messages) */}
            {showReasoning && reasoningSteps.length > 0 && (
              <ReasoningSteps 
                steps={reasoningSteps} 
                isActive={status === 'submitted'} 
              />
            )}
            
            {/* Chat Messages */}
            <ChatOutput 
              messages={messages} 
              status={status}
              reasoningSteps={reasoningSteps}
              activeToolCalls={activeToolCalls}
              showReasoning={showReasoning}
            />
            
            {/* Welcome Screen */}
            {messages.length === 0 && (
              <div className="text-center py-12 animate-fadeIn">
                <div className="text-6xl mb-4 animate-pulse-slow">🪑</div>
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Welcome to ChaTofFun
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  外贸家具选品、运营、Listing优化、物流包装、法规认证等问题，都可以问我。
                </p>
                
                {/* Feature Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
                  {[
                    { icon: Brain, label: 'ReAct 思维链', color: 'purple' },
                    { icon: Calculator, label: '运费计算', color: 'amber' },
                    { icon: AlertCircle, label: '法规查询', color: 'red' },
                    { icon: TrendingUp, label: '趋势分析', color: 'indigo' },
                    { icon: Tags, label: 'Listing 优化', color: 'emerald' },
                    { icon: Sparkles, label: '关键词生成', color: 'cyan' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}
                    >
                      <Icon className={`w-4 h-4 text-${color}-500`} />
                      <span className={`text-xs font-medium text-${color}-700 dark:text-${color}-300`}>{label}</span>
                    </div>
                  ))}
                </div>
                
                {/* Quick Suggestions */}
                <div className="text-xs text-muted-foreground mb-3">试试这样问：</div>
                <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                  {suggestions.slice(0, 4).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSuggestionClick(s.query)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                        bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700
                        hover:shadow-md hover:scale-105 transition-all duration-200"
                    >
                      <span>{s.icon}</span>
                      <span className="text-gray-600 dark:text-gray-300">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-gray-200/50 dark:border-gray-700/50">
            {/* Extended Suggestions */}
            {messages.length === 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSuggestionClick(s.query)}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs
                      bg-white/70 dark:bg-gray-800/50
                      text-gray-700 dark:text-gray-200
                      hover:bg-gray-50 dark:hover:bg-gray-800/70
                      transition-all duration-200"
                    style={{ borderColor: 'hsl(var(--theme-primary) / 0.3)' }}
                  >
                    <span>{s.icon}</span>
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            )}
            
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
            />
            
            {/* Stats */}
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>按 Enter 发送，Shift + Enter 换行</span>
              {conversationCount > 0 && (
                <span>本次会话: {conversationCount} 条对话</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Info Footer ── */}
      <div className="py-3 text-center text-xs text-muted-foreground space-y-1">
        <p>
          💡 开启「思维链」可查看 AI 的推理过程，支持多轮思考和工具调用
        </p>
        <p>
          🔧 新增功能：运费计算器、法规查询、利润估算、关键词生成等
        </p>
      </div>

      {/* Active Tool Toast */}
      {activeToolCalls.length > 0 && activeToolCalls[0] && (
        <ToolCallToast 
          toolName={activeToolCalls[0].name}
          params={activeToolCalls[0].args}
        />
      )}
    </main>
  );
}

// Import missing icons
import { AlertCircle, TrendingUp, Calculator as CalcIcon } from 'lucide-react';
const Calculator = CalcIcon;
