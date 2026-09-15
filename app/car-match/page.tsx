"use client";
import { useState } from "react";
import Link from "next/link";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import CarMatchResult, { type MatchData } from "@/components/CarMatchResult";

interface Answers {
  adventure: number;
  spending: number;
  family: number;
  techLove: number;
  statusCare: number;
  environmentCare: number;
  drivingFun: number;
  safety: number;
  practicality: number;
  style: number;
  independence: number;
  brandLoyalty: number;
  commuteDistance: number;
  annualMileage: number;
  passengerFreq: number;
  parkingCondition: number;
  budget: number;
  fuelPreference: number;
  cargoNeed: number;
  weatherCondition: number;
}

const INIT: Answers = {
  adventure: 3,
  spending: 3,
  family: 3,
  techLove: 3,
  statusCare: 3,
  environmentCare: 3,
  drivingFun: 3,
  safety: 3,
  practicality: 3,
  style: 3,
  independence: 3,
  brandLoyalty: 3,
  commuteDistance: 35,
  annualMileage: 80,
  passengerFreq: 3,
  parkingCondition: 2,
  budget: 25,
  fuelPreference: 1,
  cargoNeed: 3,
  weatherCondition: 1,
};

const STRATEGY_QUESTIONS: Array<{
  key: keyof Answers;
  question: string;
  icon: string;
  low: string;
  high: string;
}> = [
  { key: "adventure", question: "愿意尝试新品类、新市场（新渠道/新区域）吗？", icon: "🌍", low: "稳健深耕现有盘", high: "积极开拓新机会" },
  { key: "spending", question: "在样品、摄影与素材品质上的投入意愿？", icon: "📸", low: "控制成本优先", high: "愿为质感重金投入" },
  { key: "family", question: "团队与 B 端客户体量感（协同、订单分散度）？", icon: "🤝", low: "小团队精耕", high: "多客户大体量协同" },
  { key: "techLove", question: "独立站、3D/视频、数字化展示的重视程度？", icon: "💻", low: "够用即可", high: "数字化强展示" },
  { key: "statusCare", question: "品牌形象、溢价与统一视觉的重视度？", icon: "✨", low: "走量为主", high: "品牌溢价优先" },
  { key: "environmentCare", question: "环保、可持续与认证（如 FSC 等）的重视？", icon: "🌿", low: "合规底线即可", high: "可持续卖点优先" },
  { key: "drivingFun", question: "设计创新大胆度（造型、结构、混搭）？", icon: "🎨", low: "经典稳妥款", high: "大胆差异化设计" },
  { key: "safety", question: "质检、测试与合规文档的优先级？", icon: "📋", low: "满足基本出口", high: "高标质检与文件" },
  { key: "practicality", question: "成本、交期与供应链务实的优先级？", icon: "⚙️", low: "设计驱动", high: "极致成本与交期" },
  { key: "style", question: "外观审美在选品决策中的权重？", icon: "🛋️", low: "功能结构优先", high: "颜值即卖点" },
  { key: "independence", question: "做差异化款（非大路通货）的意愿？", icon: "🔷", low: "跟热销安全款", high: "坚持差异化款" },
  { key: "brandLoyalty", question: "自有品牌坚持度 vs 接受 OEM/ODM 灵活度？", icon: "🏷️", high: "强自有品牌", low: "灵活 OEM/ODM" },
];

function SliderQuestion({
  q,
  value,
  onChange,
  index,
}: {
  q: (typeof STRATEGY_QUESTIONS)[0];
  value: number;
  onChange: (v: number) => void;
  index: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{q.icon}</span>
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "hsl(var(--theme-primary))" }}
          >
            策略画像 {index + 1}/12
          </span>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-0.5">{q.question}</p>
        </div>
      </div>
      <div className="px-1">
        <div className="flex justify-between mb-2">
          <span className="text-[11px] text-gray-400">{q.low}</span>
          <span className="text-[11px] text-gray-400">{q.high}</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => {
            const active = value === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                  active
                    ? "text-white shadow-md scale-105"
                    : "border-gray-200 dark:border-gray-600 text-gray-400 bg-transparent hover:border-gray-300"
                }`}
                style={
                  active
                    ? {
                        background: "linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))",
                        borderColor: "transparent",
                      }
                    : {}
                }
              >
                {v}
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs font-medium mt-2" style={{ color: "hsl(var(--theme-primary))" }}>
          {["非常低", "较低", "中等", "较高", "非常高"][value - 1]}
        </p>
      </div>
    </div>
  );
}

function OptionBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-2 text-xs rounded-xl border-2 font-medium transition-all duration-200 ${
        active ? "text-white shadow-md" : "border-gray-200 dark:border-gray-600 text-gray-500 bg-transparent"
      }`}
      style={
        active
          ? {
              background: "linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))",
              borderColor: "transparent",
            }
          : {}
      }
    >
      {children}
    </button>
  );
}

function BusinessSection({ answers, set }: { answers: Answers; set: (k: keyof Answers, v: number) => void }) {
  const label = (n: number) => `经营参数 ${n}/8`;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📅</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(1)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">典型打样 / 上新周期（天）</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={14}
            max={120}
            step={1}
            value={answers.commuteDistance}
            onChange={(e) => set("commuteDistance", Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: "hsl(var(--theme-primary))" }}
          />
          <span className="text-sm font-bold w-14 text-right" style={{ color: "hsl(var(--theme-primary))" }}>
            {answers.commuteDistance} 天
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📦</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(2)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">活跃 SKU 量级（个，约数）</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={answers.annualMileage}
            onChange={(e) => set("annualMileage", Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: "hsl(var(--theme-primary))" }}
          />
          <span className="text-sm font-bold w-14 text-right" style={{ color: "hsl(var(--theme-primary))" }}>
            {answers.annualMileage}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🎧</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(3)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">售后与客户服务深度</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["轻售后", "标准", "加强", "重服务", "驻场式"].map((t, idx) => (
            <OptionBtn key={t} active={answers.passengerFreq === idx + 1} onClick={() => set("passengerFreq", idx + 1)}>
              {t}
            </OptionBtn>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🛒</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(4)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">销售渠道侧重</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { val: 1, label: "独立站为主", icon: "🌐" },
            { val: 2, label: "平台为主", icon: "🏪" },
            { val: 3, label: "混合渠道", icon: "🔀" },
          ].map(({ val, label, icon }) => (
            <OptionBtn key={val} active={answers.parkingCondition === val} onClick={() => set("parkingCondition", val)}>
              <span className="flex flex-col items-center gap-1">
                <span className="text-xl">{icon}</span>
                {label}
              </span>
            </OptionBtn>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">💰</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(5)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">单批次打样 / 开款预算（万元人民币）</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={answers.budget}
            onChange={(e) => set("budget", Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: "hsl(var(--theme-primary))" }}
          />
          <span className="text-sm font-bold w-16 text-right" style={{ color: "hsl(var(--theme-primary))" }}>
            {answers.budget} 万
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🪵</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(6)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">材质 / 工艺主线</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { val: 1, label: "木作主线", icon: "🪵" },
            { val: 2, label: "金属 / 软体", icon: "🛋️" },
            { val: 3, label: "板木 / 工程", icon: "📐" },
          ].map(({ val, label, icon }) => (
            <OptionBtn key={val} active={answers.fuelPreference === val} onClick={() => set("fuelPreference", val)}>
              <span className="flex flex-col items-center gap-1">
                <span className="text-xl">{icon}</span>
                {label}
              </span>
            </OptionBtn>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">✏️</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(7)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">定制 / ODM 订单占比诉求</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["极低", "较低", "中等", "偏高", "以定制为主"].map((t, idx) => (
            <OptionBtn key={t} active={answers.cargoNeed === idx + 1} onClick={() => set("cargoNeed", idx + 1)}>
              {t}
            </OptionBtn>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🌏</span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--theme-primary))" }}>
              {label(8)}
            </span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">目标市场侧重</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { val: 1, label: "北美为主", icon: "🇺🇸" },
            { val: 2, label: "欧洲为主", icon: "🇪🇺" },
            { val: 3, label: "亚太及其他", icon: "🌏" },
          ].map(({ val, label, icon }) => (
            <OptionBtn key={val} active={answers.weatherCondition === val} onClick={() => set("weatherCondition", val)}>
              <span className="flex flex-col items-center gap-1">
                <span className="text-xl">{icon}</span>
                {label}
              </span>
            </OptionBtn>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>完成度</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--theme-gradient-from), var(--theme-gradient-to))",
          }}
        />
      </div>
    </div>
  );
}

export default function FurnitureMatchPage() {
  const [answers, setAnswers] = useState<Answers>(INIT);
  const [step, setStep] = useState<"personality" | "habits" | "loading" | "result">("personality");
  const [result, setResult] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Answers, v: number) => setAnswers((prev) => ({ ...prev, [k]: v }));

  const countAnswered = () => {
    const keys = STRATEGY_QUESTIONS.map((q) => q.key);
    return keys.filter((k) => answers[k] !== 3).length;
  };

  const handleSubmit = async () => {
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/car-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResult(json.data);
      setStep("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "分析失败，请重试");
      setStep("habits");
    }
  };

  const handleRetry = () => {
    setAnswers(INIT);
    setResult(null);
    setStep("personality");
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
              title="返回首页"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1
                className="text-xl font-bold bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))" }}
              >
                🪑 ChaTofFun 选品助手
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">基于外贸家具站点策略，生成产品线与爆款方向建议</p>
            </div>
          </div>
          <ThemeSwitcher />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {step === "personality" && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">第一步：策略画像</h2>
              <p className="text-sm text-gray-500 mt-1">共 12 题，反映站点选品与品牌策略倾向</p>
              <div className="mt-3">
                <ProgressBar step={countAnswered()} total={12} />
              </div>
            </div>
            {STRATEGY_QUESTIONS.map((q, i) => (
              <SliderQuestion key={q.key} q={q} value={answers[q.key] as number} onChange={(v) => set(q.key, v)} index={i} />
            ))}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStep("habits")}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-base transition-all duration-200 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))" }}
              >
                下一步：经营参数 →
              </button>
            </div>
          </div>
        )}

        {step === "habits" && (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">第二步：经营参数</h2>
              <p className="text-sm text-gray-500 mt-1">共 8 项，帮助 AI 对齐渠道、预算与市场</p>
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                ⚠️ {error}
              </div>
            )}
            <BusinessSection answers={answers} set={set} />
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("personality")}
                className="flex-1 py-3 rounded-2xl font-medium text-sm border-2 transition-all duration-200"
                style={{ borderColor: "hsl(var(--theme-primary)/0.4)", color: "hsl(var(--theme-primary))" }}
              >
                ← 上一步
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-[2] py-3.5 rounded-2xl text-white font-semibold text-base transition-all duration-200 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, var(--theme-gradient-from), var(--theme-gradient-to))" }}
              >
                🚀 生成选品建议
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-700" />
              <div
                className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: `hsl(var(--theme-primary)) transparent transparent transparent` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-3xl">🪑</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">ChaTofFun 正在生成建议…</h3>
            <p className="text-sm text-gray-400">综合 20 项问卷，输出 3 条产品线方向（内部讨论用）</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">📋 选品与产品线建议</h2>
              <p className="text-sm text-gray-500 mt-1">基于问卷的 AI 归纳，请结合后台数据与供应链再决策</p>
            </div>
            <CarMatchResult data={result} onRetry={handleRetry} />
          </div>
        )}
      </div>
    </main>
  );
}
