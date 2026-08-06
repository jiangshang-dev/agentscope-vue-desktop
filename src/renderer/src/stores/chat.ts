import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  confirmChat,
  createSession,
  listSessions,
  loadMessages,
  streamChat,
  uploadFile,
} from '../api/client'
import type {
  AccessScope,
  ChatMessage,
  ConfirmPayload,
  SessionOut,
  StepEvent,
} from '../api/types'

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<SessionOut[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const steps = ref<StepEvent[]>([])
  const pendingConfirm = ref<ConfirmPayload | null>(null)
  const workRoot = ref('')
  const accessScope = ref<AccessScope>('sandbox')
  const enableRag = ref(true)
  const attachments = ref<string[]>([])
  const busy = ref(false)
  const statusText = ref('')
  const errorText = ref('')
  let abort: AbortController | null = null

  async function refreshSessions(): Promise<void> {
    sessions.value = await listSessions()
  }

  async function newSession(title = '新对话'): Promise<void> {
    const s = await createSession(title)
    currentSessionId.value = s.id
    messages.value = []
    steps.value = []
    pendingConfirm.value = null
    await refreshSessions()
  }

  async function openSession(sessionId: string): Promise<void> {
    currentSessionId.value = sessionId
    const list = await loadMessages(sessionId)
    messages.value = list
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: uid(),
        role: m.role,
        content: m.content,
      }))
    steps.value = []
    pendingConfirm.value = null
  }

  function stop(): void {
    abort?.abort()
    abort = null
    busy.value = false
    const last = messages.value[messages.value.length - 1]
    if (last?.streaming) {
      last.streaming = false
      if (!last.content) last.content = '（已停止）'
    }
  }

  function handleSse(event: string, data: Record<string, unknown>, assistantId: string): void {
    if (event === 'session' && typeof data.session_id === 'string') {
      currentSessionId.value = data.session_id
    } else if (event === 'step') {
      const step: StepEvent = {
        id: String(data.id || uid()),
        phase: String(data.phase || ''),
        title: String(data.title || ''),
        detail: data.detail ? String(data.detail) : undefined,
        status: data.status ? String(data.status) : undefined,
      }
      const idx = steps.value.findIndex((s) => s.id === step.id)
      if (idx >= 0) steps.value[idx] = { ...steps.value[idx], ...step }
      else steps.value.push(step)
      statusText.value = step.title
    } else if (event === 'delta' && typeof data.text === 'string') {
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) msg.content += data.text
    } else if (event === 'confirm') {
      pendingConfirm.value = data as ConfirmPayload
    } else if (event === 'done') {
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) {
        if (typeof data.full_text === 'string' && data.full_text) {
          msg.content = data.full_text
        }
        msg.streaming = false
      }
      if (typeof data.session_id === 'string') currentSessionId.value = data.session_id
      if (!data.pending_confirm) pendingConfirm.value = null
    } else if (event === 'error') {
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) {
        msg.content = `⚠️ ${String(data.message || '未知错误')}`
        msg.streaming = false
      }
      errorText.value = String(data.message || '错误')
    }
  }

  async function send(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || busy.value) return

    messages.value.push({ id: uid(), role: 'user', content: trimmed })
    const assistantId = uid()
    messages.value.push({ id: assistantId, role: 'assistant', content: '', streaming: true })
    busy.value = true
    statusText.value = '智能体思考中…'
    errorText.value = ''
    steps.value = []
    pendingConfirm.value = null
    abort = new AbortController()

    try {
      await streamChat(
        {
          session_id: currentSessionId.value,
          message: trimmed,
          work_root: workRoot.value || null,
          access_scope: accessScope.value,
          enable_rag: enableRag.value,
          attachment_paths: [...attachments.value],
        },
        (event, data) => handleSse(event, data, assistantId),
        abort.signal,
      )
      attachments.value = []
      await refreshSessions()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) {
        msg.streaming = false
        if (!msg.content) msg.content = `⚠️ ${e instanceof Error ? e.message : '发送失败'}`
      }
      errorText.value = e instanceof Error ? e.message : '发送失败'
    } finally {
      busy.value = false
      abort = null
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) msg.streaming = false
      statusText.value = ''
    }
  }

  async function answerConfirm(accept: boolean): Promise<void> {
    if (!currentSessionId.value || busy.value) return
    const assistantId = uid()
    messages.value.push({ id: assistantId, role: 'assistant', content: '', streaming: true })
    busy.value = true
    pendingConfirm.value = null
    abort = new AbortController()
    try {
      await confirmChat(
        currentSessionId.value,
        accept,
        (event, data) => handleSse(event, data, assistantId),
        abort.signal,
      )
      await refreshSessions()
    } catch (e) {
      errorText.value = e instanceof Error ? e.message : '确认失败'
    } finally {
      busy.value = false
      abort = null
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) msg.streaming = false
    }
  }

  async function uploadLocalFile(file: File): Promise<void> {
    const res = await uploadFile(file, currentSessionId.value || undefined)
    if (res.relative_path) attachments.value.push(res.relative_path)
  }

  function removeAttachment(path: string): void {
    attachments.value = attachments.value.filter((p) => p !== path)
  }

  return {
    sessions,
    currentSessionId,
    messages,
    steps,
    pendingConfirm,
    workRoot,
    accessScope,
    enableRag,
    attachments,
    busy,
    statusText,
    errorText,
    refreshSessions,
    newSession,
    openSession,
    send,
    stop,
    answerConfirm,
    uploadLocalFile,
    removeAttachment,
  }
})
