export type AccessScope = 'sandbox' | 'full' | 'restricted'

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

export interface AuthUser {
  id: number
  username: string
  display_name?: string
}

export interface TokenOut {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface SessionOut {
  id: string
  title: string
  updated_at?: string | null
  message_count: number
}

export interface MessageOut {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: string[]
  created_at?: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
}

export interface StepEvent {
  id: string
  phase: string
  title: string
  detail?: string
  status?: string
}

export interface ConfirmPayload {
  tool_calls?: Array<{ name: string; input?: string }>
  message?: string
  [key: string]: unknown
}

export interface ChatStreamBody {
  session_id?: string | null
  message: string
  work_root?: string | null
  access_scope?: AccessScope
  enable_rag?: boolean
  attachment_paths?: string[]
}
