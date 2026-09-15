/**
 * ReasoningSteps Component
 * 
 * Displays the AI agent's reasoning process in real-time,
 * showing thought steps, tool calls, and observations.
 */

"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Brain, Search, BarChart3, GitCompare, FileText, CheckCircle2, Loader2 } from "lucide-react";

interface ReasoningStep {
  step: number;
  thought: string;
  action: string | null;
  observation: string | null;
  isFinal: boolean;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  isActive: boolean;
  themePrimary?: string;
}

// Icon mapping for tools
const toolIcons: Record<string, typeof Search> = {
  query_vector_db: Search,
  analyze_trends: BarChart3,
  compare_products: GitCompare,
  summarize_knowledge: FileText,
};

export default function ReasoningSteps({ steps, isActive, themePrimary = '#6366f1' }: ReasoningStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  
  // Auto-expand new steps
  useEffect(() => {
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      setExpandedSteps(prev => new Set([...prev, lastStep.step]));
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
  
  if (steps.length === 0 && !isActive) {
    return null;
  }
  
  return (
    <div className="mb-4 animate-fadeIn">
      {/* Header */}
      <div 
        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
        style={{ backgroundColor: `${themePrimary}10` }}
      >
        <Brain className="w-4 h-4" style={{ color: themePrimary }} />
        <span className="text-sm font-medium" style={{ color: themePrimary }}>
          AI 思考过程
        </span>
        {isActive && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <Loader2 className="w-3 h-3 animate-spin" />
            分析中...
          </span>
        )}
      </div>
      
      {/* Steps */}
      <div className="space-y-2 pl-2">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.step);
          const isFinal = step.isFinal;
          const hasObservation = step.observation && step.observation.length > 0;
          
          return (
            <div 
              key={step.step}
              className={`rounded-lg border transition-all duration-200 ${
                isFinal 
                  ? 'border-green-200 bg-green-50 dark:bg-green-900/10' 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {/* Step Header */}
              <button
                onClick={() => toggleStep(step.step)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span 
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isFinal 
                      ? 'bg-green-500 text-white' 
                      : 'text-white'
                  }`}
                  style={{ 
                    backgroundColor: isFinal ? '#22c55e' : themePrimary 
                  }}
                >
                  {isFinal ? <CheckCircle2 className="w-4 h-4" /> : step.step}
                </span>
                
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                  {step.thought}
                </span>
                
                <span className="flex-shrink-0 text-gray-400">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              </button>
              
              {/* Step Content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Action */}
                  {step.action && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {getActionLabel(step.action)}
                      </span>
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded break-all">
                        {formatAction(step.action)}
                      </code>
                    </div>
                  )}
                  
                  {/* Observation */}
                  {hasObservation && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                        📊 观察结果:
                      </span>
                      <div 
                        className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto"
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {formatObservation(step.observation!)}
                      </div>
                    </div>
                  )}
                  
                  {/* Final indicator */}
                  {isFinal && (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs mt-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>准备给出最终回答</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper functions
function getActionLabel(action: string): string {
  if (action.startsWith('query_vector_db')) return '🔍 搜索知识库:';
  if (action.startsWith('analyze_trends')) return '📈 分析趋势:';
  if (action.startsWith('compare_products')) return '⚖️ 对比产品:';
  if (action.startsWith('summarize_knowledge')) return '📋 总结知识:';
  return '⚡ 操作:';
}

function formatAction(action: string): string {
  // Extract tool name and params
  const match = action.match(/^(\w+)\((.*)\)$/);
  if (match) {
    const [, tool, params] = match;
    try {
      const parsed = JSON.parse(params);
      return `${tool}: ${JSON.stringify(parsed, null, 2)}`;
    } catch {
      return params;
    }
  }
  return action;
}

function formatObservation(observation: string): string {
  // Try to parse and format JSON observations
  try {
    const parsed = JSON.parse(observation);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return observation;
  }
}

/**
 * ToolCallBadge Component
 * Shows a badge when a tool is being called
 */
export function ToolCallBadge({ tool, params }: { tool: string; params: Record<string, unknown> }) {
  const Icon = toolIcons[tool] || Search;
  
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
      <Icon className="w-3 h-3" />
      <span className="font-medium">{getToolDisplayName(tool)}</span>
    </div>
  );
}

function getToolDisplayName(tool: string): string {
  const names: Record<string, string> = {
    query_vector_db: '查询知识库',
    analyze_trends: '分析趋势',
    compare_products: '产品对比',
    summarize_knowledge: '知识总结'
  };
  return names[tool] || tool;
}

/**
 * ReasoningIndicator Component
 * Shows a pulsing indicator during active reasoning
 */
export function ReasoningIndicator({ themePrimary = '#6366f1' }: { themePrimary?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: themePrimary }}>
      <div className="flex gap-0.5">
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
      <span className="font-medium">AI 正在思考...</span>
    </div>
  );
}
