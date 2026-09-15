/**
 * ChatOutput Component - Enhanced with ReAct Reasoning Display
 * 
 * Shows messages with optional reasoning steps for AI responses.
 */

"use client";
import type { Message } from "ai";
import ReactMarkdown from "react-markdown";
import ReasoningSteps, { ToolCallBadge, ReasoningIndicator } from "./ReasoningSteps";

interface ReasoningStep {
  step: number;
  thought: string;
  action: string | null;
  observation: string | null;
  isFinal: boolean;
}

interface ChatOutputProps {
  messages: Message[];
  status: string;
  reasoningSteps?: ReasoningStep[];
  activeToolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  showReasoning?: boolean;
}

export default function ChatOutput({
  messages,
  status,
  reasoningSteps = [],
  activeToolCalls = [],
  showReasoning = true
}: ChatOutputProps) {
  return (
    <>
      {messages.map((message, index) =>
        message.role === "user" ? (
          <UserChat key={index} content={message.content} />
        ) : (
          <AssistantChat 
            key={index} 
            content={message.content}
            reasoningSteps={index === messages.length - 1 ? reasoningSteps : []}
            activeToolCalls={index === messages.length - 1 ? activeToolCalls : []}
            showReasoning={showReasoning}
            isLatest={index === messages.length - 1}
          />
        )
      )}

      {/* Active Reasoning Indicator */}
      {(status === "submitted" || status === "streaming") && (
        <div className="mb-6">
          {activeToolCalls.length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-muted-foreground">正在使用工具:</span>
              {activeToolCalls.map((tool, i) => (
                <ToolCallBadge key={i} tool={tool.name} params={tool.args} />
              ))}
            </div>
          )}
          <ReasoningIndicator />
        </div>
      )}

      {/* Reasoning Steps (when streaming) */}
      {(status === "submitted" || status === "streaming") && showReasoning && reasoningSteps.length > 0 && (
        <ReasoningSteps steps={reasoningSteps} isActive={status === "submitted"} />
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>发生错误，请重试。</span>
        </div>
      )}
    </>
  );
}

const UserChat = ({ content }: { content: any }) => (
  <div className="flex justify-end mb-6 animate-fadeIn">
    <div
      className="theme-bubble-user text-white rounded-2xl rounded-br-md
        max-w-[80%] w-fit px-4 py-3 shadow-lg
        transform transition-all duration-200 hover:scale-[1.02]"
    >
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  </div>
);

interface AssistantChatProps {
  content: any;
  reasoningSteps?: ReasoningStep[];
  activeToolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  showReasoning?: boolean;
  isLatest?: boolean;
}

const AssistantChat = ({ 
  content, 
  reasoningSteps = [], 
  activeToolCalls = [],
  showReasoning = true,
  isLatest = false 
}: AssistantChatProps) => {
  return (
    <div className="flex justify-start mb-6 animate-slideUp">
      <div className="max-w-[85%]">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 theme-ai-avatar rounded-full flex items-center justify-center shadow-md"
          >
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <span className="text-xs text-muted-foreground">ChaTofFun</span>
          {isLatest && showReasoning && reasoningSteps.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              思维链已开启
            </span>
          )}
        </div>
        
        <div
          className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-md p-4
            shadow-md border border-gray-200 dark:border-gray-600
            transform transition-all duration-200 hover:shadow-lg"
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a
                    target="_blank"
                    href={href}
                    className="underline"
                    style={{ color: 'hsl(var(--theme-primary))' }}
                  >
                    {children}
                  </a>
                ),
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                ),
                code: ({ children }) => (
                  <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                    {children}
                  </pre>
                ),
                h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic my-2">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
