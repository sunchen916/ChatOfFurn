"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  input: string;
  handleInputChange: (e: any) => void;
  handleSubmit: (e: any) => void;
  /** 是否正在生成（加载中），为 true 时显示停止按钮 */
  isLoading?: boolean;
  /** 点击停止按钮时调用，中断当前流式生成 */
  onStop?: () => void;
}

export default function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading = false,
  onStop,
}: ChatInputProps) {
  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1 relative">
        <Input
          onChange={handleInputChange}
          value={input}
          placeholder="问问选品、Listing、材质、物流或站点政策…"
          disabled={isLoading}
          className="pr-12 py-3 text-base rounded-xl border-2
            bg-white dark:bg-gray-700 shadow-sm
            transition-all duration-200 resize-none
            focus:shadow-lg"
          style={{
            borderColor: 'hsl(var(--theme-primary) / 0.25)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'hsl(var(--theme-primary) / 0.7)';
            e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--theme-primary) / 0.15)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'hsl(var(--theme-primary) / 0.25)';
            e.currentTarget.style.boxShadow = '';
          }}
        />
      </div>

      {isLoading ? (
        /* 停止按钮 - 中断当前生成 */
        <Button
          type="button"
          onClick={onStop}
          title="停止生成"
          className="h-12 w-12 rounded-xl shadow-lg transition-all duration-200
            bg-red-500 hover:bg-red-600 text-white"
        >
          <Square className="h-4 w-4 fill-current" />
          <span className="sr-only">Stop</span>
        </Button>
      ) : (
        /* 发送按钮 */
        <Button
          type="submit"
          disabled={!input.trim()}
          className="h-12 w-12 rounded-xl shadow-lg transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed theme-btn"
          style={{
            background: input.trim()
              ? 'linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))'
              : undefined,
          }}
        >
          <ArrowUp className="h-5 w-5" />
          <span className="sr-only">Submit</span>
        </Button>
      )}
    </form>
  );
}
