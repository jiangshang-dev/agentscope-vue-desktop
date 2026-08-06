/**
 * 鉴权与 API 连接状态（Pinia）。
 *
 * 持久化：localStorage 存 token、user、apiBase；与 api/client 的 setAuthToken/setApiBase 同步。
 * 协作：router 读 isAuthed；LoginView 调 login/register/checkHealth；ChatView 读 user/online。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getEnvApiBase,
  healthCheck,
  login as apiLogin,
  register as apiRegister,
  setApiBase,
  setAuthToken,
} from '../api/client'
import type { AuthUser, HealthOut } from '../api/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('agentscope.accessToken'))
  const user = ref<AuthUser | null>(
    (() => {
      try {
        const raw = localStorage.getItem('agentscope.user')
        return raw ? (JSON.parse(raw) as AuthUser) : null
      } catch {
        return null
      }
    })(),
  )
  const apiBase = ref(localStorage.getItem('agentscope.apiBase') || getEnvApiBase())
  const health = ref<HealthOut | null>(null)
  const online = ref(false)
  const loading = ref(false)
  const error = ref('')

  const isAuthed = computed(() => Boolean(token.value))

  function persistUser(u: AuthUser | null): void {
    user.value = u
    if (u) localStorage.setItem('agentscope.user', JSON.stringify(u))
    else localStorage.removeItem('agentscope.user')
  }

  async function checkHealth(): Promise<boolean> {
    try {
      health.value = await healthCheck()
      online.value = Boolean(health.value?.ok)
      error.value = ''
      return online.value
    } catch (e) {
      online.value = false
      health.value = null
      error.value = e instanceof Error ? e.message : '无法连接 API'
      return false
    }
  }

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      // 登录前先应用用户在 LoginView 填写的 API 地址
      setApiBase(apiBase.value)
      const res = await apiLogin(username, password)
      token.value = res.access_token
      setAuthToken(res.access_token)
      persistUser(res.user)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e instanceof Error ? e.message : '登录失败')
      error.value = String(msg)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(username: string, password: string, displayName = ''): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      setApiBase(apiBase.value)
      const res = await apiRegister(username, password, displayName)
      token.value = res.access_token
      setAuthToken(res.access_token)
      persistUser(res.user)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e instanceof Error ? e.message : '注册失败')
      error.value = String(msg)
      throw e
    } finally {
      loading.value = false
    }
  }

  function logout(): void {
    token.value = null
    setAuthToken(null)
    persistUser(null)
    // 会话数据在 chat store，由 ChatView 跳转 login 后不再挂载；token 清除即无法调 API
  }

  function updateApiBase(url: string): void {
    apiBase.value = url.replace(/\/$/, '')
    setApiBase(apiBase.value)
  }

  return {
    token,
    user,
    apiBase,
    health,
    online,
    loading,
    error,
    isAuthed,
    checkHealth,
    login,
    register,
    logout,
    updateApiBase,
  }
})
