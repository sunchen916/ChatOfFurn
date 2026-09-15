<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const name = ref('')
const success = ref<string | null>(null)

const title = computed(() => (mode.value === 'login' ? '欢迎登录' : '创建账号'))
const subtitle = 'ChaTofFun 账号用于登录站点助手（聊天与选品问卷）'

async function onSubmit() {
  success.value = null
  if (mode.value === 'login') {
    await auth.login(email.value, password.value)
    success.value = '登录成功，正在跳转…'
  } else {
    await auth.register({ name: name.value || undefined, email: email.value, password: password.value })
    success.value = '注册并登录成功，正在跳转…'
  }
  const next = typeof route.query.next === 'string' ? route.query.next : '/'
  await router.replace(next)
}
</script>

<template>
  <main class="page">
    <div class="card">
      <div class="brand">🪑</div>
      <h1 class="h1">{{ title }}</h1>
      <p class="muted">{{ subtitle }}</p>

      <div class="tabs">
        <button class="tab" :class="{ active: mode === 'login' }" type="button" @click="mode = 'login'">登录</button>
        <button class="tab" :class="{ active: mode === 'register' }" type="button" @click="mode = 'register'">注册</button>
      </div>

      <form class="form" @submit.prevent="onSubmit">
        <label v-if="mode === 'register'" class="field">
          <span>昵称</span>
          <input v-model="name" placeholder="你的名字（可选）" autocomplete="nickname" />
        </label>

        <label class="field">
          <span>邮箱</span>
          <input v-model="email" type="email" placeholder="you@example.com" autocomplete="email" required />
        </label>

        <label class="field">
          <span>密码</span>
          <input v-model="password" type="password" placeholder="至少 6 位" autocomplete="current-password" required />
        </label>

        <p v-if="auth.error" class="error">{{ auth.error }}</p>
        <p v-if="success" class="success">{{ success }}</p>

        <button class="primary" :disabled="auth.loading" type="submit">
          {{ auth.loading ? '处理中...' : mode === 'login' ? '登录' : '注册并登录' }}
        </button>
      </form>

      <div class="footer">
        <a href="/" @click.prevent="router.push('/')">返回首页</a>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 18px;
  box-shadow: var(--shadow);
  padding: 20px;
}
@media (prefers-color-scheme: dark) {
  .card {
    background: rgba(22, 23, 29, 0.7);
  }
}
.brand {
  font-size: 44px;
  text-align: center;
  margin-bottom: 8px;
}
.h1 {
  font-size: 22px;
  margin: 0;
  text-align: center;
}
.muted {
  text-align: center;
  font-size: 13px;
  opacity: 0.8;
  margin: 6px 0 16px;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tab {
  flex: 1;
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
}
.tab.active {
  background: var(--text-h);
  color: var(--bg);
  border-color: transparent;
}
.form {
  display: grid;
  gap: 12px;
}
.field {
  display: grid;
  gap: 6px;
  text-align: left;
}
.field span {
  font-size: 13px;
  color: var(--text-h);
}
input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-h);
  box-sizing: border-box;
}
@media (prefers-color-scheme: dark) {
  input {
    background: rgba(31, 32, 40, 0.6);
  }
}
.primary {
  margin-top: 4px;
  width: 100%;
  padding: 12px 14px;
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
  color: #ef4444;
  font-size: 13px;
  margin: 0;
}
.success {
  color: #16a34a;
  font-size: 13px;
  margin: 0;
}
.footer {
  margin-top: 14px;
  font-size: 13px;
  text-align: center;
}
.footer a {
  color: var(--accent);
  text-decoration: underline;
}
</style>

