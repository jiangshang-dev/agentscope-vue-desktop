/**
 * HTTP 与 SSE 客户端：封装 AgentScope REST API 与流式对话。
 *
 * - Axios 实例：鉴权头、baseURL（env + localStorage 覆盖）
 * - streamChat / confirmChat：fetch + 手动解析 SSE（event/data 行）
 * - 被 stores/auth、stores/chat 及 LoginView 直接调用
 */
import axios, { type AxiosInstance } from 'axios'
import type {
  AuthUser,
  ChatStreamBody,
  HealthOut,
  MessageOut,
  SessionOut,
  TokenOut,
} from './types'

/** 统一来自 .env.* 的 VITE_API_BASE_URL；登录页可临时覆盖并写入 localStorage */
export function getEnvApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  return fromEnv || 'http://127.0.0.1:8765'
}

function getBaseUrl(): string {
  const override = (localStorage.getItem('agentscope.apiBase') || '').trim().replace(/\/$/, '')
  return override || getEnvApiBase()
}

function getToken(): string | null {
  return localStorage.getItem('agentscope.accessToken')
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem('agentscope.accessToken', token)
  else localStorage.removeItem('agentscope.accessToken')
}

export function setApiBase(url: string): void {
  const normalized = url.trim().replace(/\/$/, '')
  // 与 env 一致时清掉覆盖，始终以 .env 为准
  if (!normalized || normalized === getEnvApiBase()) {
    localStorage.removeItem('agentscope.apiBase')
  } else {
    localStorage.setItem('agentscope.apiBase', normalized)
  }
}

export function createHttp(): AxiosInstance {
  const http = axios.create({
    baseURL: getBaseUrl(),
    timeout: 60000,
  })
  // 每次请求刷新 baseURL 与 Bearer token（登录后 token 可能刚写入）
  http.interceptors.request.use((config) => {
    config.baseURL = getBaseUrl()
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })
  return http
}

const http = createHttp()

export async function healthCheck(): Promise<HealthOut> {
  const { data } = await http.get<HealthOut>('/health')
  return data
}

export async function login(username: string, password: string): Promise<TokenOut> {
  const { data } = await http.post<TokenOut>('/v1/auth/login', { username, password })
  return data
}

export async function register(
  username: string,
  password: string,
  displayName = '',
): Promise<TokenOut> {
  const { data } = await http.post<TokenOut>('/v1/auth/register', {
    username,
    password,
    display_name: displayName,
  })
  return data
}

export async function listSessions(): Promise<SessionOut[]> {
  const { data } = await http.get<SessionOut[]>('/v1/sessions')
  return data
}

export async function createSession(title = '新对话'): Promise<SessionOut> {
  const { data } = await http.post<SessionOut>('/v1/sessions', { title })
  return data
}

export async function deleteSession(sessionId: string): Promise<{ ok: boolean; session_id: string }> {
  const { data } = await http.delete<{ ok: boolean; session_id: string }>(`/v1/sessions/${sessionId}`)
  return data
}

export async function loadMessages(sessionId: string): Promise<MessageOut[]> {
  const { data } = await http.get<MessageOut[]>(`/v1/sessions/${sessionId}/messages`)
  return data
}

export async function uploadFile(file: File, sessionId?: string): Promise<{
  ok: boolean
  relative_path: string
  absolute_path: string
  filename: string
}> {
  const form = new FormData()
  form.append('file', file)
  if (sessionId) form.append('session_id', sessionId)
  const { data } = await http.post('/v1/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export type SseHandler = (event: string, data: Record<string, unknown>) => void

/**
 * 发起流式对话 POST /v1/chat/stream，按 SSE 规范逐块解析并回调 onEvent。
 * event 常见值：session / step / delta / confirm / done / error（见 stores/chat handleSse）。
 */
export async function streamChat(
  body: ChatStreamBody,
  onEvent: SseHandler,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken()
  const res = await fetch(`${getBaseUrl()}/v1/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `SSE 失败 HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  // 空行表示一个 SSE 事件结束，合并多行 data: 后 JSON.parse
  const flush = (): void => {
    if (!dataLines.length) return
    const raw = dataLines.join('\n')
    dataLines = []
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>
      onEvent(eventName, obj)
    } catch {
      // ignore malformed chunk
    }
    eventName = 'message'
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // 保留未完整的一行在 buffer，避免跨 chunk 截断
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() || ''
    for (const line of parts) {
      if (line.startsWith(':')) continue // SSE 注释行
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      } else if (line === '') {
        flush()
      }
    }
  }
  if (dataLines.length) flush()
}

/** 用户确认/拒绝工具调用后继续流式输出；解析逻辑与 streamChat 相同 */
export async function confirmChat(
  sessionId: string,
  accept: boolean,
  onEvent: SseHandler,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken()
  const res = await fetch(`${getBaseUrl()}/v1/chat/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId, accept, accept_rules: true }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`确认失败 HTTP ${res.status}`)
  }
  // 与 streamChat 相同的 SSE 行解析（未抽公共函数以避免改动行为）
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []
  const flush = (): void => {
    if (!dataLines.length) return
    const raw = dataLines.join('\n')
    dataLines = []
    try {
      onEvent(eventName, JSON.parse(raw) as Record<string, unknown>)
    } catch {
      /* ignore */
    }
    eventName = 'message'
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() || ''
    for (const line of parts) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      else if (line === '') flush()
    }
  }
  if (dataLines.length) flush()
}

export type { AuthUser }
