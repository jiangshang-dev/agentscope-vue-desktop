/**
 * 与 AgentScope 后端 API 对齐的 TypeScript 类型。
 * 被 api/client（请求/响应）、stores/chat（消息与步骤）、组件 props 共用。
 */

/** 智能体文件访问范围：沙箱 / 完全 / 受限 */
export type AccessScope = 'sandbox' | 'full' | 'restricted'

/** GET /health 返回，LoginView 展示连接状态与模型信息 */
export interface HealthOut {
  ok: boolean
  service: string
  version: string
  agent_mode: string
  vector_db_provider: string
  model_name: string
  vision_model: string
  features: string[]
}

/** 登录/注册成功后返回的用户摘要 */
export interface AuthUser {
  id: number
  username: string
  display_name?: string
}

/** POST /v1/auth/login|register 响应；access_token 由 client 写入 localStorage */
export interface TokenOut {
  access_token: string
  token_type: string
  user: AuthUser
}

/** 会话列表项；侧栏展示 title、message_count */
export interface SessionOut {
  id: string
  title: string
  updated_at?: string | null
  message_count: number
}

/** 历史消息（服务端）；assistant 的 meta.steps 用于回显思考步骤 */
export interface MessageOut {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: string[]
  created_at?: string | null
  meta?: {
    steps?: StepEvent[]
    [key: string]: unknown
  }
}

/** 前端聊天列表用的消息模型；比 MessageOut 多 id、streaming、本地 steps 缓存 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 流式输出中为 true，done/error 事件后置 false */
  streaming?: boolean
  /** 该条助手消息对应的执行步骤（含历史回显与 SSE step 事件累积） */
  steps?: StepEvent[]
  /** 用户消息携带的附件（发送时写入，历史从 MessageOut.attachments 回显） */
  attachments?: ChatAttachment[]
}

/** 会话内附件展示信息；path 发给后端，name/previewUrl 仅前端 UI */
export interface ChatAttachment {
  path: string
  name: string
  /** 图片本地预览（blob:）；历史回显无此字段则只显示文件卡片 */
  previewUrl?: string
}

/** 单步思考/工具执行；来自 SSE event:step 或服务端 meta.steps */
export interface StepEvent {
  id: string
  phase: string
  title: string
  detail?: string
  /** running / done / error 等，驱动侧栏与 ChatBubble 状态展示 */
  status?: string
}

/** SSE event:confirm 载荷；ChatView 底部展示允许/拒绝工具调用 */
export interface ConfirmPayload {
  tool_calls?: Array<{ name: string; input?: string }>
  message?: string
  [key: string]: unknown
}

/** POST /v1/chat/stream 请求体 */
export interface ChatStreamBody {
  session_id?: string | null
  message: string
  work_root?: string | null
  access_scope?: AccessScope
  enable_rag?: boolean
  attachment_paths?: string[]
}
