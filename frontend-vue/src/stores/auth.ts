import { defineStore } from 'pinia'
import { apiFetch } from '../api/http'

export type User = { id: string; email: string; name: string | null }

type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthed: (s) => !!s.user,
  },
  actions: {
    async fetchMe() {
      try {
        const res = await apiFetch('/api/auth/me')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          this.user = null
          return
        }
        this.user = data.user ?? null
      } catch {
        this.user = null
      }
    },
    async login(email: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || '登录失败')
        this.user = data.user ?? null
      } catch (e: any) {
        this.error = e?.message || '登录失败'
        throw e
      } finally {
        this.loading = false
      }
    },
    async register(params: { name?: string; email: string; password: string }) {
      this.loading = true
      this.error = null
      try {
        const res = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(params),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || '注册失败')
        this.user = data.user ?? null
      } catch (e: any) {
        this.error = e?.message || '注册失败'
        throw e
      } finally {
        this.loading = false
      }
    },
    async logout() {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' })
      } finally {
        this.user = null
      }
    },
  },
})

