<script setup lang="ts">
import { ref } from 'vue'
import { apiFetch } from '../api/http'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

/** 与 Next `app/api/car-match/route.ts` 中 QuizAnswers 一致 */
type QuizAnswers = {
  adventure: number
  spending: number
  family: number
  techLove: number
  statusCare: number
  environmentCare: number
  drivingFun: number
  safety: number
  practicality: number
  style: number
  independence: number
  brandLoyalty: number
  commuteDistance: number
  annualMileage: number
  passengerFreq: number
  parkingCondition: number
  budget: number
  fuelPreference: number
  cargoNeed: number
  weatherCondition: number
}

type MatchItem = {
  rank: number
  name: string
  price: string
  type: string
  fuel: string
  totalScore: number
  reason: string
  highlight: string
  dimensions: Record<string, number>
}

type MatchPayload = {
  summary: string
  top3: MatchItem[]
}

const STRATEGY_FIELDS = [
  { key: 'adventure' as const, label: '新品类/新市场探索意愿', hint: '1=稳健深耕 5=积极开拓' },
  { key: 'spending' as const, label: '样品与素材品质投入意愿', hint: '1=控成本 5=愿为质感投入' },
  { key: 'family' as const, label: '团队协同与客户体量感', hint: '1=小团队精耕 5=多客户大体量' },
  { key: 'techLove' as const, label: '独立站/数字化展示重视度', hint: '1=够用 5=强展示' },
  { key: 'statusCare' as const, label: '品牌形象与溢价重视度', hint: '1=走量 5=品牌溢价' },
  { key: 'environmentCare' as const, label: '环保与认证重视度', hint: '1=底线合规 5=可持续卖点' },
  { key: 'drivingFun' as const, label: '设计创新大胆度', hint: '1=经典稳妥 5=大胆差异化' },
  { key: 'safety' as const, label: '质检与合规文档优先级', hint: '1=基本出口 5=高标质检' },
  { key: 'practicality' as const, label: '成本与交期务实度', hint: '1=设计驱动 5=极致成本交期' },
  { key: 'style' as const, label: '外观审美在选品中的权重', hint: '1=功能优先 5=颜值卖点' },
  { key: 'independence' as const, label: '差异化款（非大路货）意愿', hint: '1=跟热销 5=坚持差异化' },
  { key: 'brandLoyalty' as const, label: '自有品牌坚持度', hint: '5=强自有品牌 1=灵活 OEM/ODM' },
]

const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<MatchPayload | null>(null)

const answers = ref<QuizAnswers>({
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
})

async function submit() {
  loading.value = true
  error.value = null
  result.value = null
  try {
    const res = await apiFetch('/api/car-match', {
      method: 'POST',
      body: JSON.stringify({ answers: answers.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) throw new Error(data?.error || '生成失败')
    const payload = data.data as MatchPayload
    if (!payload?.summary || !Array.isArray(payload.top3)) {
      result.value = null
      throw new Error('返回格式异常')
    }
    result.value = payload
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '生成失败'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  result.value = null
  error.value = null
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand" @click="router.push('/')">🪑 ChaTofFun</div>
      <nav class="nav">
        <button class="link" type="button" @click="router.push('/')">聊天</button>
        <button class="link active" type="button" @click="router.push('/car-match')">选品助手</button>
        <button class="link" type="button" @click="auth.logout()">退出</button>
      </nav>
    </header>

    <main class="content">
      <div class="card">
        <h1 class="h1">🪑 ChaTofFun 选品助手</h1>
        <p class="muted">
          根据外贸家具站点的<strong>策略画像</strong>与<strong>经营参数</strong>生成
          <strong>TOP3 产品线/爆款方向</strong>（由后端 <code>/api/car-match</code> 调用大模型生成，供内部讨论，非合同报价）。
        </p>

        <section class="section">
          <h2 class="section-title">策略画像（每项 1～5）</h2>
          <div class="grid">
            <label v-for="row in STRATEGY_FIELDS" :key="row.key" class="field">
              <span>{{ row.label }}</span>
              <small class="hint">{{ row.hint }}</small>
              <input
                v-model.number="answers[row.key]"
                type="number"
                min="1"
                max="5"
                step="1"
              />
            </label>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">经营参数</h2>
          <div class="grid">
            <label class="field">
              <span>打样 / 上新周期（天）</span>
              <input v-model.number="answers.commuteDistance" type="number" min="14" max="120" step="1" />
            </label>
            <label class="field">
              <span>活跃 SKU 量级（约数）</span>
              <input v-model.number="answers.annualMileage" type="number" min="10" max="400" step="5" />
            </label>
            <label class="field">
              <span>售后与客户服务深度（1～5）</span>
              <input v-model.number="answers.passengerFreq" type="number" min="1" max="5" step="1" />
            </label>
            <label class="field">
              <span>销售渠道侧重</span>
              <select v-model.number="answers.parkingCondition">
                <option :value="1">独立站为主</option>
                <option :value="2">第三方平台为主</option>
                <option :value="3">独立站 + 平台混合</option>
              </select>
            </label>
            <label class="field">
              <span>单批次打样预算（万元人民币）</span>
              <input v-model.number="answers.budget" type="number" min="5" max="120" step="5" />
            </label>
            <label class="field">
              <span>材质 / 工艺主线</span>
              <select v-model.number="answers.fuelPreference">
                <option :value="1">木作主线</option>
                <option :value="2">金属 / 软体主线</option>
                <option :value="3">板木结合 / 工程配套</option>
              </select>
            </label>
            <label class="field">
              <span>定制 / ODM 占比诉求（1～5）</span>
              <input v-model.number="answers.cargoNeed" type="number" min="1" max="5" step="1" />
            </label>
            <label class="field">
              <span>目标市场侧重</span>
              <select v-model.number="answers.weatherCondition">
                <option :value="1">北美为主</option>
                <option :value="2">欧洲为主</option>
                <option :value="3">亚太及其他</option>
              </select>
            </label>
          </div>
        </section>

        <div class="actions">
          <button class="primary" :disabled="loading" type="button" @click="submit">
            {{ loading ? '生成中…' : '生成选品建议' }}
          </button>
          <button v-if="result" class="ghost" type="button" @click="resetForm">清空结果</button>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <div v-if="result" class="outcome">
          <div class="summary-box">
            <div class="summary-label">站点选品画像</div>
            <p class="summary-text">{{ result.summary }}</p>
          </div>
          <ol class="rec-list">
            <li v-for="item in result.top3" :key="item.rank" class="rec-card">
              <div class="rec-head">
                <span class="badge">#{{ item.rank }}</span>
                <span class="score">{{ item.totalScore }} 分</span>
              </div>
              <h3 class="rec-name">{{ item.name }}</h3>
              <p class="rec-meta">
                <span>{{ item.type }}</span>
                <span class="sep">·</span>
                <span>{{ item.price }}</span>
              </p>
              <p class="rec-mat"><strong>材质工艺</strong>：{{ item.fuel }}</p>
              <p v-if="item.highlight" class="rec-hl">{{ item.highlight }}</p>
              <p class="rec-reason">{{ item.reason }}</p>
            </li>
          </ol>
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
  font-weight: 700;
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
  place-items: start center;
  padding: 16px;
}
.card {
  width: 100%;
  max-width: 900px;
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow);
  padding: 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
}
@media (prefers-color-scheme: dark) {
  .card {
    background: rgba(22, 23, 29, 0.6);
  }
}
.h1 {
  font-size: 22px;
  margin: 0;
}
.muted {
  font-size: 13px;
  opacity: 0.85;
  margin: 6px 0 16px;
  line-height: 1.5;
}
.muted code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--code-bg);
}
.section {
  margin-bottom: 18px;
}
.section-title {
  font-size: 15px;
  margin: 0 0 10px;
  color: var(--text-h);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.field {
  display: grid;
  gap: 4px;
}
.field span {
  font-size: 13px;
  color: var(--text-h);
  font-weight: 500;
}
.hint {
  font-size: 11px;
  opacity: 0.75;
  margin: 0;
}
input,
select {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-h);
}
@media (prefers-color-scheme: dark) {
  input,
  select {
    background: rgba(31, 32, 40, 0.6);
  }
}
.actions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.primary {
  padding: 10px 16px;
  border-radius: 12px;
  border: none;
  background: var(--text-h);
  color: var(--bg);
  cursor: pointer;
  font-weight: 600;
}
.primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.ghost {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-h);
  cursor: pointer;
  font-size: 13px;
}
.error {
  margin: 10px 0 0;
  color: #ef4444;
  font-size: 13px;
}
.outcome {
  margin-top: 16px;
}
.summary-box {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  margin-bottom: 14px;
}
.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  margin-bottom: 4px;
}
.summary-text {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}
.rec-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}
.rec-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.45);
}
@media (prefers-color-scheme: dark) {
  .rec-card {
    background: rgba(31, 32, 40, 0.45);
  }
}
.rec-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.badge {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.8;
}
.score {
  font-size: 13px;
  font-weight: 700;
}
.rec-name {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--text-h);
}
.rec-meta {
  margin: 0 0 6px;
  font-size: 13px;
  opacity: 0.85;
}
.sep {
  margin: 0 4px;
}
.rec-mat {
  margin: 0 0 6px;
  font-size: 13px;
}
.rec-hl {
  margin: 0 0 6px;
  font-size: 12px;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
}
.rec-reason {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  opacity: 0.9;
}
</style>
