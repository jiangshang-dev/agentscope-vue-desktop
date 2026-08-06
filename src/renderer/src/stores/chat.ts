/**
 * 聊天会话、消息流与思考步骤（Pinia）。
 *
 * 核心数据流：
 * - send() → streamChat() → handleSse() 更新 messages / steps
 * - steps：右侧「思考」侧栏当前展示的快照；每条 assistant 消息的 steps 也存在 message 上
 * - showStepsForMessage：点击气泡「思考」pill 时，把该消息的 steps 同步到侧栏
 *
 * 协作：ChatView 绑定 UI；ChatBubble 展示单条消息与思考入口；api/client 负责 SSE。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  confirmChat,
  createSession,
  deleteSession,
  listSessions,
  loadMessages,
  streamChat,
  uploadFile,
} from '../api/client'
import type {
  AccessScope,
  ChatAttachment,
  ChatMessage,
  ConfirmPayload,
  SessionOut,
  StepEvent,
} from '../api/types'

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function fileBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

function toAttachment(path: string, name?: string, previewUrl?: string): ChatAttachment {
  return {
    path,
    name: name || fileBasename(path),
    previewUrl,
  }
}

function isImageName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|tif?f)$/i.test(name)
}

function normalizeSteps(raw: unknown): StepEvent[] {
  // 历史消息 meta.steps 或 done 事件里的 steps 可能字段不全，统一补 id/字符串化
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const s = (item || {}) as Record<string, unknown>
    return {
      id: String(s.id || uid()),
      phase: String(s.phase || ''),
      title: String(s.title || ''),
      detail: s.detail != null ? String(s.detail) : undefined,
      status: s.status != null ? String(s.status) : undefined,
    }
  })
}

function upsertStep(list: StepEvent[], step: StepEvent): StepEvent[] {
  // 同 id 的步骤为更新（状态从 running → done），否则追加
  const idx = list.findIndex((s) => s.id === step.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = { ...next[idx], ...step }
    return next
  }
  return [...list, step]
}

function markStepsDone(list: StepEvent[]): StepEvent[] {
  return list.map((s) =>
    s.status === 'error' || s.status === 'done' ? s : { ...s, status: 'done' },
  )
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<SessionOut[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  /** 右侧思考侧栏当前展示的步骤列表（可能是某条历史消息或正在流式的那条） */
  const steps = ref<StepEvent[]>([])
  /** 与 steps 侧栏联动：当前选中查看思考过程的 assistant 消息 id */
  const activeMessageId = ref<string | null>(null)
  const pendingConfirm = ref<ConfirmPayload | null>(null)
  const workRoot = ref('')
  const accessScope = ref<AccessScope>('sandbox')
  const enableRag = ref(true)
  /** 扫描 PDF 多模态识读；默认关，避免无谓烧 Token */
  const enableVisionOcr = ref(false)
  /** 输入区待发送附件（发送后挂到用户气泡并清空） */
  const attachments = ref<ChatAttachment[]>([])
  const busy = ref(false)
  const statusText = ref('')
  const errorText = ref('')
  let abort: AbortController | null = null

  async function refreshSessions(): Promise<void> {
    sessions.value = await listSessions()
  }

  async function newSession(title = '新对话'): Promise<void> {
    // 避免反复点「新对话」堆出一堆 0 条空会话：优先复用已有空会话
    await refreshSessions()

    const isEmptySession = (s: SessionOut) => (s.message_count ?? 0) === 0

    // 当前就是空对话：只重置本地 UI，不调创建接口
    if (currentSessionId.value) {
      const cur = sessions.value.find((s) => s.id === currentSessionId.value)
      if (cur && isEmptySession(cur) && messages.value.length === 0) {
        messages.value = []
        steps.value = []
        activeMessageId.value = null
        pendingConfirm.value = null
        attachments.value = []
        return
      }
    }

    // 侧栏里已有空会话：打开最新一条，并清理多余的空会话
    const empties = sessions.value.filter(isEmptySession)
    if (empties.length > 0) {
      const keep = empties[0]
      for (const extra of empties.slice(1)) {
        try {
          await deleteSession(extra.id)
        } catch {
          // 清理失败不影响主流程
        }
      }
      sessions.value = sessions.value.filter(
        (s) => s.id === keep.id || !isEmptySession(s),
      )
      await openSession(keep.id)
      return
    }

    const s = await createSession(title)
    currentSessionId.value = s.id
    messages.value = []
    steps.value = []
    activeMessageId.value = null
    pendingConfirm.value = null
    attachments.value = []
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
        steps: m.role === 'assistant' ? normalizeSteps(m.meta?.steps) : undefined,
        attachments: (m.attachments || []).map((p) => toAttachment(p)),
      }))
    steps.value = []
    activeMessageId.value = null
    pendingConfirm.value = null
  }

  async function removeSession(sessionId: string): Promise<void> {
    await deleteSession(sessionId)
    const wasCurrent = currentSessionId.value === sessionId
    sessions.value = sessions.value.filter((s) => s.id !== sessionId)
    if (wasCurrent) {
      // 删的是当前会话：清空消息与侧栏，若还有其它会话则自动打开第一条
      currentSessionId.value = null
      messages.value = []
      steps.value = []
      activeMessageId.value = null
      pendingConfirm.value = null
      attachments.value = []
      if (sessions.value.length) {
        await openSession(sessions.value[0].id)
      }
    }
  }

  /** 用户点击某条助手消息的「思考」时：切换 activeMessageId 并把该消息的 steps 灌入侧栏 */
  function showStepsForMessage(messageId: string): void {
    const msg = messages.value.find((m) => m.id === messageId)
    if (!msg || msg.role !== 'assistant') return
    activeMessageId.value = messageId
    steps.value = [...(msg.steps || [])]
  }

  function clearActiveSteps(): void {
    activeMessageId.value = null
    // 非流式时关闭侧栏可清空 steps；流式中保留以便继续接收 step 事件
    if (!busy.value) steps.value = []
  }

  function stop(): void {
    abort?.abort()
    abort = null
    busy.value = false
    const last = messages.value[messages.value.length - 1]
    if (last?.streaming) {
      last.streaming = false
      if (!last.content) last.content = '（已停止）'
      if (last.steps?.length) {
        last.steps = markStepsDone(last.steps)
        if (activeMessageId.value === last.id) steps.value = [...last.steps]
      }
    }
  }

  /**
   * 处理 streamChat / confirmChat 的 SSE 回调。
   * assistantId 对应当前轮次占位 assistant 消息，delta 追加 content，step 双写 message.steps 与侧栏 steps。
   */
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
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) {
        msg.steps = upsertStep(msg.steps || [], step)
      }
      // 侧栏跟随：正在看这条消息，或尚未选中任何消息（默认跟流式）
      if (activeMessageId.value === assistantId || !activeMessageId.value) {
        activeMessageId.value = assistantId
        steps.value = upsertStep(steps.value, step)
      }
      statusText.value = step.title
    } else if (event === 'delta' && typeof data.text === 'string') {
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) msg.content += data.text
    } else if (event === 'confirm') {
      pendingConfirm.value = data as ConfirmPayload
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) msg.awaitingConfirm = true
    } else if (event === 'done') {
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) {
        if (typeof data.full_text === 'string' && data.full_text) {
          msg.content = data.full_text
        }
        msg.streaming = false
        const pending = Boolean(data.pending_confirm)
        msg.awaitingConfirm = pending
        if (pending) {
          pendingConfirm.value = pendingConfirm.value || ({ message: '需要确认工具调用' } as ConfirmPayload)
        } else {
          pendingConfirm.value = null
        }
        const fromServer = normalizeSteps(data.steps)
        if (fromServer.length) {
          msg.steps = markStepsDone(fromServer)
        } else if (msg.steps?.length) {
          msg.steps = markStepsDone(msg.steps)
        }
        if (activeMessageId.value === assistantId || !activeMessageId.value) {
          activeMessageId.value = assistantId
          steps.value = [...(msg.steps || [])]
        }
      }
      if (typeof data.session_id === 'string') currentSessionId.value = data.session_id
      if (!data.pending_confirm) pendingConfirm.value = null
    } else if (event === 'error') {
      const msg = messages.value.find((m) => m.id === assistantId)
      if (msg) {
        msg.content = `⚠️ ${String(data.message || '未知错误')}`
        msg.streaming = false
        if (msg.steps?.length) msg.steps = markStepsDone(msg.steps)
      }
      errorText.value = String(data.message || '错误')
    }
  }

  async function send(text: string): Promise<void> {
    // 二次拦截：即使绕过 UI，未激活也不发 SSE（Electron 下 license store 已校验）
    try {
      const { useLicenseStore } = await import('./license')
      const lic = useLicenseStore()
      if (!lic.isActivated) {
        errorText.value = '未激活：请先输入激活密钥'
        return
      }
    } catch {
      /* store 不可用时放行，由路由守卫兜底 */
    }

    const trimmed = text.trim()
    const pendingAtts = [...attachments.value]
    // 允许「只有附件、没有文字」发送
    if ((!trimmed && !pendingAtts.length) || busy.value) return

    messages.value.push({
      id: uid(),
      role: 'user',
      content: trimmed || (pendingAtts.length ? '（见附件）' : ''),
      attachments: pendingAtts,
    })
    attachments.value = []
    const assistantId = uid()
    messages.value.push({
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      steps: [],
    })
    busy.value = true
    statusText.value = '智能体思考中…'
    errorText.value = ''
    steps.value = []
    activeMessageId.value = assistantId
    pendingConfirm.value = null
    abort = new AbortController()

    try {
      // SSE 事件由 handleSse 写入 assistant 占位消息与 steps 侧栏
      await streamChat(
        {
          session_id: currentSessionId.value,
          message: trimmed || '请查看附件并处理',
          work_root: workRoot.value || null,
          access_scope: accessScope.value,
          enable_rag: enableRag.value,
          enable_vision_ocr: enableVisionOcr.value,
          attachment_paths: pendingAtts.map((a) => a.path),
        },
        (event, data) => handleSse(event, data, assistantId),
        abort.signal,
      )
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
      // HITL 挂起时保持 awaitingConfirm，勿当成「已完成的空回复」
      if (msg && !msg.awaitingConfirm) msg.streaming = false
      statusText.value = ''
    }
  }

  async function answerConfirm(accept: boolean): Promise<void> {
    if (!currentSessionId.value || busy.value) return

    // 复用「等待确认」的那条助手消息，避免多出一条空的「（无回复）」
    const existing = [...messages.value]
      .reverse()
      .find((m) => m.role === 'assistant' && m.awaitingConfirm)
    const assistantId = existing?.id || uid()
    if (existing) {
      existing.streaming = true
      existing.awaitingConfirm = false
      if (!existing.steps?.length && steps.value.length) {
        existing.steps = [...steps.value]
      }
    } else {
      messages.value.push({
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        steps: [...steps.value],
      })
    }

    busy.value = true
    activeMessageId.value = assistantId
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
      if (msg && !msg.awaitingConfirm) msg.streaming = false
    }
  }

  async function uploadLocalFile(file: File): Promise<void> {
    const res = await uploadFile(file, currentSessionId.value || undefined)
    if (!res.relative_path) return
    const displayName = (res.filename || file.name || '').trim() || fileBasename(res.relative_path)
    const previewUrl =
      isImageName(displayName) || (file.type || '').startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined
    attachments.value = [
      ...attachments.value,
      toAttachment(res.relative_path, displayName, previewUrl),
    ]
  }

  function removeAttachment(path: string): void {
    const hit = attachments.value.find((a) => a.path === path)
    if (hit?.previewUrl) URL.revokeObjectURL(hit.previewUrl)
    attachments.value = attachments.value.filter((a) => a.path !== path)
  }

  return {
    sessions,
    currentSessionId,
    messages,
    steps,
    activeMessageId,
    pendingConfirm,
    workRoot,
    accessScope,
    enableRag,
    enableVisionOcr,
    attachments,
    busy,
    statusText,
    errorText,
    refreshSessions,
    newSession,
    openSession,
    removeSession,
    showStepsForMessage,
    clearActiveSteps,
    send,
    stop,
    answerConfirm,
    uploadLocalFile,
    removeAttachment,
  }
})
