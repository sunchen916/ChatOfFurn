import { createOpenAI } from "@ai-sdk/openai";

/** 从 .env 粘贴的 Key 常带 BOM、零宽空格、全角字符；OpenAI/DeepSeek Key 本体应全为 ASCII */
function sanitizeApiKey(raw: string): string {
  let s = raw.normalize("NFKC");
  s = s.replace(/^\uFEFF+/, "");
  s = s.replace(/^[\u200B-\u200D\uFEFF\u2060\u00A0\s]+/, "");
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u00A0\s]+$/, "");
  const asciiOnly = Array.from(s)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 33 && c <= 126;
    })
    .join("");
  return asciiOnly;
}

/** HTTP 头（如 Authorization）须为 Latin-1；中文、弯引号会触发 undici ByteString 报错 */
function requireHttpHeaderSafeAscii(value: string, label: string): string {
  const s = value.replace(/^\uFEFF/, "").trim();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 255) {
      throw new Error(
        `${label} 在第 ${i + 1} 个字符处含有非 ASCII（常见于误粘贴中文、弯引号「」或同一行写了注释）。请只保留纯英文/数字/符号的 Key，注释单独成行。`
      );
    }
  }
  return s;
}

function normalizeOptionalUrl(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return requireHttpHeaderSafeAscii(s, "baseURL");
}

// NOTE: Node/undici 不会自动走系统代理。默认只认 OPENAI_PROXY_URL，避免 Windows 全局 HTTPS_PROXY=127.0.0.1:6478 误伤本地脚本。
// 需要继承系统代理时设置 OPENAI_HONOR_SYSTEM_PROXY=1；完全不走代理设 AI_DISABLE_PROXY=1。
function getProxyUrl(): string | undefined {
  const disabled =
    process.env.AI_DISABLE_PROXY === "1" ||
    process.env.AI_DISABLE_PROXY === "true";
  if (disabled) return undefined;

  const explicit = process.env.OPENAI_PROXY_URL?.trim();
  if (explicit) return explicit;

  const honor =
    process.env.OPENAI_HONOR_SYSTEM_PROXY === "1" ||
    process.env.OPENAI_HONOR_SYSTEM_PROXY === "true";
  if (!honor) return undefined;

  const v =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY;
  return v?.trim() || undefined;
}

function createProxyFetch() {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return undefined;

  // Import lazily to avoid bundling issues in edge runtimes.
  // Next route handlers here are intended to run in Node.js runtime.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ProxyAgent, fetch: undiciFetch } = require("undici") as typeof import("undici");
  const dispatcher = new ProxyAgent(proxyUrl);

  const proxyFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    return undiciFetch(input as any, {
      ...(init as any),
      dispatcher,
    }) as any;
  };

  return proxyFetch;
}

function createOpenAIClient(apiKey: string | undefined, baseURL: string | undefined) {
  let safeKey: string | undefined;
  if (apiKey) {
    const cleaned = sanitizeApiKey(apiKey);
    if (!cleaned) {
      throw new Error(
        "API Key 在去除不可见字符后为空。请从控制台重新复制 OPENAI_API_KEY（或 EMBEDDING_API_KEY），并确保等号后整行只有 Key、无中文注释。"
      );
    }
    safeKey = requireHttpHeaderSafeAscii(cleaned, "API Key（OPENAI_API_KEY / DEEPSEEK_API_KEY / EMBEDDING_API_KEY）");
  }
  const safeBase = baseURL ? normalizeOptionalUrl(baseURL) : undefined;
  const proxyFetch = createProxyFetch();
  return createOpenAI({
    apiKey: safeKey,
    baseURL: safeBase,
    ...(proxyFetch ? { fetch: proxyFetch } : {}),
  });
}

/**
 * 对话 / 补全（OpenAI 兼容）。配置了 DEEPSEEK_API_KEY 时默认走 DeepSeek，否则走 OPENAI。
 * 官方说明 base_url: https://api.deepseek.com （与 OpenAI SDK 搭配时常用 .../v1）
 */
export function getChatProvider() {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (deepseekKey) {
    return createOpenAIClient(
      deepseekKey,
      process.env.CHAT_API_BASE_URL?.trim() || "https://api.deepseek.com/v1"
    );
  }

  return createOpenAIClient(
    openaiKey,
    process.env.CHAT_API_BASE_URL?.trim() ||
      process.env.OPENAI_API_BASE_URL?.trim() ||
      "https://api.openai.com/v1"
  );
}

/**
 * RAG 向量：须与灌库时使用的模型、向量维度一致（如 text-embedding-ada-002 → 1536）。
 * DeepSeek 官方 API 以对话为主；若无可用 embedding，请保留 OPENAI（或任意 OpenAI 兼容 embedding 端点）的 Key。
 */
export function getEmbeddingProvider() {
  const raw =
    process.env.EMBEDDING_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "";
  const apiKey = raw.trim();

  if (!apiKey) {
    throw new Error(
      "RAG 灌库需要 embedding：请在 .env 或 .env.local 中设置 OPENAI_API_KEY 或 EMBEDDING_API_KEY（OpenAI 兼容 /v1/embeddings）。仅配置 DEEPSEEK_API_KEY 无法生成向量。\n" +
        "注意：.env.local 里若写了「OPENAI_API_KEY=」但等号后留空，会覆盖 .env 里原来的 Key；请删掉空行或填上完整 Key。"
    );
  }

  return createOpenAIClient(
    apiKey,
    process.env.EMBEDDING_API_BASE_URL?.trim() ||
      process.env.OPENAI_API_BASE_URL?.trim() ||
      "https://api.openai.com/v1"
  );
}

/** 未设置 CHAT_MODEL 时的默认对话模型名 */
export function getDefaultChatModelId(): string {
  const explicit = process.env.CHAT_MODEL?.trim();
  if (explicit) return explicit;
  return process.env.DEEPSEEK_API_KEY?.trim() ? "deepseek-chat" : "gpt-4o-mini";
}

/** 与 OpenAI 兼容的 embedding 模型 id（须与 Supabase 中已存向量一致） */
export function getEmbeddingModelId(): string {
  return process.env.EMBEDDING_MODEL?.trim() || "text-embedding-ada-002";
}

/** @deprecated 请使用 getChatProvider()；语义与 getChatProvider 相同 */
export function getOpenAI() {
  return getChatProvider();
}
