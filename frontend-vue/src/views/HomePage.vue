<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../api/http'

type Role = 'user' | 'assistant' | 'system'
type ChatMessage = { role: Role; content: string }

const router = useRouter()
const auth = useAuthStore()

const input = ref('')
const messages = ref<ChatMessage[]>([])
const status = ref<'ready' | 'sending' | 'streaming' | 'error'>('ready')
const error = ref<string | null>(null)

const suggestions = [
  '北美客厅家具主流材质与价位带怎么定？',
  '独立站 Listing 里卖点怎么排序更利于转化？',
  '平板包装沙发在欧洲市场的注意事项有哪些？',
  '如何从现有 SKU 里提炼下一季「爆款方向」？',
]

function addSuggestion(text: string) {
  input.value = text
}

async function send() {
  const text = input.value.trim()
  if (!text || status.value !== 'ready') return

  error.value = null
  status.value = 'sending'

  messages.value.push({ role: 'user', content: text })
  input.value = ''

  // Create an assistant message placeholder for streaming
  const assistant: ChatMessage = { role: 'assistant', content: '' }
  messages.value.push(assistant)

  try {
    const res = await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: messages.value.filter((m) => m.role !== 'system') }),
    })

    if (!res.ok || !res.body) {
      const data = await res.text().catch(() => '')
      throw new Error(data || `请求失败（${res.status}）`)
    }

    status.value = 'streaming'

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Vercel AI data stream is line-based; keep a best-effort parser:
      // - append any non-empty lines (after stripping common "data:" prefixes)
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const raw = line.trim()
        if (!raw) continue
        const cleaned = raw.startsWith('data:') ? raw.slice(5).trim() : raw
        if (!cleaned || cleaned === '[DONE]') continue
        // Try parse JSON chunks; if fails, append as text.
        try {
          const obj = JSON.parse(cleaned)
          const delta =
            obj?.delta?.content ??
            obj?.text ??
            obj?.data ??
            obj?.content ??
            (typeof obj === 'string' ? obj : null)
          if (typeof delta === 'string') assistant.content += delta
        } catch {
          assistant.content += cleaned
        }
      }
    }

    status.value = 'ready'
  } catch (e: any) {
    status.value = 'error'
    error.value = e?.message || '发送失败'
  } finally {
    if (status.value !== 'ready') status.value = 'ready'
  }
}

onMounted(() => {
  // best-effort to refresh user display
  auth.fetchMe()
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand" @click="router.push('/')">🪑 ChaTofFun</div>
      <nav class="nav">
        <button class="link active" type="button" @click="router.push('/')">聊天</button>
        <button class="link" type="button" @click="router.push('/car-match')">选品助手</button>
        <button class="link" type="button" @click="auth.logout()">退出</button>
      </nav>
    </header>

    <main class="content">
      <div class="card">
        <div class="messages">
          <div v-if="messages.length === 0" class="empty">
            <div class="emoji">🪑</div>
            <h2>ChaTofFun</h2>
            <p class="muted">外贸家具站点运营与选品助手：结合知识库回答 Listing、物流、材质与选品方向等问题。</p>
            <div class="chips">
              <button v-for="s in suggestions" :key="s" class="chip" type="button" @click="addSuggestion(s)">{{ s }}</button>
            </div>
          </div>

          <div v-for="(m, idx) in messages" :key="idx" class="msg" :class="m.role">
            <div class="role">{{ m.role === 'user' ? '你' : 'ChaTofFun' }}</div>
            <div class="bubble">{{ m.content }}</div>
          </div>
        </div>

        <div class="composer">
          <form class="row" @submit.prevent="send">
            <input v-model="input" class="input" placeholder="输入你的问题..." />
            <button class="primary" type="submit" :disabled="status !== 'ready' || !input.trim()">
              {{ status === 'streaming' ? '生成中...' : '发送' }}
            </button>
          </form>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}
@media (prefers-color-scheme: dark) {
  .topbar {
    background: rgba(22, 23, 29, 0.8);
  }
}
.brand {
  font-weight: 800;
  color: var(--text-h);
  cursor: pointer;
}
.nav {
  display: flex;
  gap: 8px;
}
.link {
  border: 1px solid var(--border);
  background: transparent;
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
}
.link.active {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--text-h);
}
.content {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 16px;
}
.card {
  width: 100%;
  max-width: 980px;
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
}
@media (prefers-color-scheme: dark) {
  .card {
    background: rgba(22, 23, 29, 0.6);
  }
}
.messages {
  height: calc(100svh - 220px);
  min-height: 420px;
  overflow: auto;
  padding: 16px;
  display: grid;
  gap: 12px;
}
.empty {
  text-align: center;
  padding: 40px 12px;
}
.emoji {
  font-size: 52px;
  margin-bottom: 10px;
}
.muted {
  font-size: 13px;
  opacity: 0.85;
}
.chips {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.chip {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
}
@media (prefers-color-scheme: dark) {
  .chip {
    background: rgba(31, 32, 40, 0.6);
  }
}
.msg {
  display: grid;
  gap: 6px;
}
.msg.user {
  justify-items: end;
}
.role {
  font-size: 12px;
  opacity: 0.75;
}
.bubble {
  max-width: 85%;
  white-space: pre-wrap;
  line-height: 1.5;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.75);
  color: var(--text-h);
}
@media (prefers-color-scheme: dark) {
  .bubble {
    background: rgba(31, 32, 40, 0.65);
  }
}
.msg.user .bubble {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}
.composer {
  border-top: 1px solid var(--border);
  padding: 12px;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
.input {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-h);
}
@media (prefers-color-scheme: dark) {
  .input {
    background: rgba(31, 32, 40, 0.6);
  }
}
.primary {
  padding: 10px 14px;
  border-radius: 12px;
  border: none;
  background: var(--text-h);
  color: var(--bg);
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.error {
  margin: 8px 0 0;
  color: #ef4444;
  font-size: 13px;
}
</style>

