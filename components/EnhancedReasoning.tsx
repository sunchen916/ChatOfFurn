/**
 * Enhanced Reasoning Steps Component
 * 
 * Improved visualization of the ReAct agent's reasoning process
 * with animations and detailed step information.
 */

"use client";
import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Search,
  BarChart3,
  GitCompare,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  Calculator,
  Globe,
  Package,
  Tags,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  Copy,
  Check
} from "lucide-react";

export interface ReasoningStep {
  step: number;
  thought: string;
  action: string | null;
  observation: string | null;
  isFinal: boolean;
  toolName?: string;
  toolParams?: Record<string, unknown>;
}

export interface ToolInfo {
  name: string;
  description: string;
  icon: typeof Search;
  color: string;
}

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  isActive: boolean;
  themePrimary?: string;
  onStepClick?: (step: ReasoningStep) => void;
}

// Tool metadata
const TOOL_INFO: Record<string, ToolInfo> = {
  query_vector_db: {
    name: '查询知识库',
    description: '搜索向量数据库中的相关信息',
    icon: Search,
    color: '#6366f1'
  },
  analyze_trends: {
    name: '分析趋势',
    description: '分析产品趋势和爆款潜力',
    icon: TrendingUp,
    color: '#8b5cf6'
  },
  compare_products: {
    name: '产品对比',
    description: '对比多个产品的特性',
    icon: GitCompare,
    color: '#ec4899'
  },
  summarize_knowledge: {
    name: '总结知识',
    description: '获取主题的综合概述',
    icon: FileText,
    color: '#14b8a6'
  },
  calculate_shipping: {
    name: '计算运费',
    description: '估算物流成本和运输方案',
    icon: Package,
    color: '#f59e0b'
  },
  check_regulations: {
    name: '法规检查',
    description: '检查目标市场的合规要求',
    icon: AlertCircle,
    color: '#ef4444'
  },
  analyze_listing: {
    name: '分析Listing',
    description: '优化产品列表和文案',
    icon: Tags,
    color: '#10b981'
  },
  estimate_profit: {
    name: '利润估算',
    description: '计算利润率和建议定价',
    icon: Calculator,
    color: '#22c55e'
  },
  generate_keywords: {
    name: '关键词生成',
    description: '生成 SEO 和广告关键词',
    icon: Sparkles,
    color: '#06b6d4'
  },
  compare_packaging: {
    name: '包装对比',
    description: '比较不同包装方案',
    icon: Package,
    color: '#f97316'
  }
};

export default function ReasoningSteps({
  steps,
  isActive,
  themePrimary = '#6366f1',
  onStepClick
}: ReasoningStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest step
  useEffect(() => {
    if (steps.length > 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps]);
  
  // Auto-expand new steps
  useEffect(() => {
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep.isFinal) {
        // Expand all steps when final
        setExpandedSteps(new Set(steps.map(s => s.step)));
      } else {
        setExpandedSteps(prev => new Set([...prev, lastStep.step]));
      }
    }
  }, [steps]);
  
  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(step)) {
        newSet.delete(step);
      } else {
        newSet.add(step);
      }
      return newSet;
    });
  };
  
  const copyStep = async (step: ReasoningStep) => {
    const text = formatStepForCopy(step);
    await navigator.clipboard.writeText(text);
    setCopiedStep(step.step);
    setTimeout(() => setCopiedStep(null), 2000);
  };
  
  if (steps.length === 0 && !isActive) {
    return null;
  }
  
  return (
    <div 
      ref={containerRef}
      className="mb-4 max-h-[400px] overflow-y-auto rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-900/10 dark:to-indigo-900/10"
    >
      {/* Header */}
      <div 
        className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 border-b border-purple-100 dark:border-purple-800/50 backdrop-blur-sm"
        style={{ backgroundColor: `${themePrimary}08` }}
      >
        <div className="relative">
          <Brain className="w-5 h-5" style={{ color: themePrimary }} />
          {isActive && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        <span className="text-sm font-semibold" style={{ color: themePrimary }}>
          AI 推理过程
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {steps.length} 步
        </span>
      </div>
      
      {/* Steps */}
      <div className="p-3 space-y-2">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.step);
          const isFinal = step.isFinal;
          const hasAction = step.action && !isFinal;
          const hasObservation = step.observation && step.observation.length > 0;
          const toolInfo = step.toolName ? TOOL_INFO[step.toolName] : null;
          
          return (
            <div 
              key={step.step}
              className={`rounded-lg transition-all duration-200 ${
                isFinal 
                  ? 'border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' 
                  : 'border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/50'
              } ${onStepClick ? 'cursor-pointer hover:shadow-md' : ''}`}
              onClick={() => onStepClick?.(step)}
            >
              {/* Step Header */}
              <button
                onClick={() => toggleStep(step.step)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
              >
                {/* Step Number */}
                <div 
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                    isFinal ? 'bg-green-500' : ''
                  }`}
                  style={!isFinal ? { backgroundColor: themePrimary } : undefined}
                >
                  {isFinal ? <CheckCircle2 className="w-4 h-4" /> : step.step}
                </div>
                
                {/* Arrow between steps */}
                {index > 0 && (
                  <ArrowRight className="absolute left-[18px] top-8 w-3 h-3 -mt-4 text-gray-300 dark:text-gray-600" />
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {step.thought}
                    </span>
                  </div>
                  
                  {/* Tool badge */}
                  {hasAction && toolInfo && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <toolInfo.icon 
                        className="w-3.5 h-3.5" 
                        style={{ color: toolInfo.color }} 
                      />
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${toolInfo.color}15`,
                          color: toolInfo.color 
                        }}
                      >
                        {toolInfo.name}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Expand indicator */}
                <span className="flex-shrink-0 text-gray-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              </button>
              
              {/* Step Content */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-700/50 mt-1">
                  {/* Action Details */}
                  {hasAction && step.toolParams && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        参数
                      </span>
                      <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <pre className="text-xs font-mono text-gray-600 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(step.toolParams, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {/* Observation */}
                  {hasObservation && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          观察结果
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyStep(step);
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="复制结果"
                        >
                          {copiedStep === step.step ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <div className="mt-1 p-2 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50 max-h-32 overflow-y-auto">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                          {formatObservation(step.observation!)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {/* Final indicator */}
                  {isFinal && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>推理完成，准备给出最终回答</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Active indicator */}
        {isActive && (
          <div className="flex items-center gap-2 py-2 px-3 text-sm" style={{ color: themePrimary }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>继续推理中...</span>
            <div className="flex gap-1 ml-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{
                    backgroundColor: themePrimary,
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function formatObservation(observation: string): string {
  try {
    const parsed = JSON.parse(observation);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return observation;
  }
}

function formatStepForCopy(step: ReasoningStep): string {
  let text = `步骤 ${step.step}: ${step.thought}\n\n`;
  if (step.action) {
    text += `操作: ${step.action}\n\n`;
  }
  if (step.observation) {
    text += `观察结果:\n${step.observation}`;
  }
  return text;
}

/**
 * Compact reasoning badge for inline display
 */
export function ReasoningBadge({ 
  count, 
  themePrimary = '#6366f1' 
}: { 
  count: number; 
  themePrimary?: string;
}) {
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ 
        backgroundColor: `${themePrimary}15`,
        color: themePrimary 
      }}
    >
      <Brain className="w-3 h-3" />
      {count} 步推理
    </span>
  );
}

/**
 * Tool call toast for showing active tools
 */
export function ToolCallToast({ 
  toolName, 
  params 
}: { 
  toolName: string; 
  params?: Record<string, unknown>;
}) {
  const info = TOOL_INFO[toolName];
  if (!info) return null;
  
  const Icon = info.icon;
  
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
      <div 
        className="flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg border backdrop-blur-sm"
        style={{ 
          backgroundColor: `${info.color}F0`,
          borderColor: info.color,
          backdropFilter: 'blur(8px)'
        }}
      >
        <Icon className="w-5 h-5 text-white" />
        <div className="text-white">
          <span className="font-medium">{info.name}</span>
          {params && (
            <span className="text-xs opacity-80 ml-2">
              {Object.values(params).slice(0, 2).join(', ')}
            </span>
          )}
        </div>
        <Loader2 className="w-4 h-4 text-white animate-spin ml-2" />
      </div>
    </div>
  );
}

/**
 * Mini reasoning indicator for the header
 */
export function MiniReasoningIndicator({ 
  steps, 
  isActive 
}: { 
  steps: ReasoningStep[]; 
  isActive: boolean;
}) {
  if (steps.length === 0 && !isActive) return null;
  
  const lastStep = steps[steps.length - 1];
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <Brain className="w-3.5 h-3.5 text-purple-500" />
      <span className="text-gray-600 dark:text-gray-300">
        {isActive ? '推理中...' : lastStep?.thought?.substring(0, 30) || '已完成'}
      </span>
      {isActive && (
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-purple-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
