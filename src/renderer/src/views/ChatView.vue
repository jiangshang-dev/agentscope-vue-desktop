<template>
  <div class="chat-layout" :class="{ 'sidebar-open': sidebarOpen, 'steps-open': stepsOpen }">
    <div v-if="sidebarOpen && isNarrow" class="mask" @click="sidebarOpen = false" />
    <div v-if="stepsOpen && isCompact" class="mask steps-mask" @click="stepsOpen = false" />

    <aside class="sidebar" :class="{ collapsed: !sidebarOpen && isNarrow }">
      <div class="side-head">
        <div>
          <div class="app-name">AgentOS</div>
          <div class="app-sub">{{ auth.user?.display_name || auth.user?.username }} · Vue Desktop</div>
        </div>
        <a-button v-if="isNarrow" type="text" class="close-btn" @click="sidebarOpen = false">✕</a-button>
      </div>

      <a-button type="primary" block class="new-btn" @click="onNewChat">
        <template #icon><PlusOutlined /></template>
        新对话
      </a-button>

      <div class="side-label">最近对话</div>
      <div class="session-list">
        <div
          v-for="s in chat.sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === chat.currentSessionId }"
          @click="onOpenSession(s.id)"
        >
          <div class="session-main">
            <div class="title">{{ s.title || '新对话' }}</div>
            <div class="meta">{{ s.message_count }} 条</div>
          </div>
          <a-popconfirm
            title="确定删除该对话？将同时清除数据库与 Redis 中的记录。"
            ok-text="删除"
            cancel-text="取消"
            ok-type="danger"
            @confirm="onDeleteSession(s.id)"
          >
            <a-button
              type="text"
              size="small"
              class="del-btn"
              danger
              @click.stop
            >
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </a-popconfirm>
        </div>
        <a-empty v-if="!chat.sessions.length" description="暂无会话" :image-style="{ height: '48px' }" />
      </div>

      <div class="side-footer">
        <div class="footer-toggles">
          <a-tooltip title="知识库向量检索">
            <a-switch
              v-model:checked="chat.enableRag"
              checked-children="RAG"
              un-checked-children="RAG"
              size="small"
            />
          </a-tooltip>
          <a-tooltip
            title="开启后：扫描版 PDF 会按页调用视觉模型 OCR（默认最多 8 页），较费 Token；文字版 PDF 会自动跳过。图片附件仍始终识图。"
          >
            <a-switch
              v-model:checked="chat.enableVisionOcr"
              checked-children="扫描件"
              un-checked-children="扫描件"
              size="small"
            />
          </a-tooltip>
        </div>
        <a-button type="text" danger @click="onLogout">退出登录</a-button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="top-left">
          <a-button v-if="isNarrow" type="text" class="icon-btn" @click="sidebarOpen = true">
            <MenuOutlined />
          </a-button>
          <span class="dot" :class="{ on: auth.online }" />
          <span class="status">
            {{ auth.online ? `API 已连接 · ${auth.health?.agent_mode || 'ok'}` : 'API 未连接' }}
          </span>
          <a-tag v-if="license.isActivated" color="success" style="margin-inline-end: 0">
            已激活{{ license.status.plan ? ` · ${license.status.plan}` : '' }}
          </a-tag>
          <a-segmented
            v-model:value="chat.accessScope"
            class="scope-seg"
            :options="scopeOptions"
            size="small"
          />
        </div>

        <div class="top-right">
          <a-typography-text type="secondary" class="work-root" :title="workRootHint">
            工作根：{{ shortWorkRoot }}
          </a-typography-text>
          <a-button size="small" @click="pickDir">选目录</a-button>
          <a-button size="small" @click="openDir" :disabled="!chat.workRoot">打开目录</a-button>
          <a-button size="small" @click="reconnect">重连</a-button>
          <a-button
            v-if="showStepsToggle"
            size="small"
            type="primary"
            ghost
            @click="toggleStepsPanel"
          >
            步骤
          </a-button>
        </div>
      </header>

      <div class="content">
        <div ref="scrollEl" class="messages">
          <div v-if="!chat.messages.length" class="hero">
            <h2>有问题，尽管问</h2>
            <p>连接 AgentScope API · 流式对话 · Ant Design Vue</p>
          </div>
          <ChatBubble
            v-for="m in chat.messages"
            :key="m.id"
            :message="m"
            :active="stepsOpen && chat.activeMessageId === m.id"
            @open-thinking="onOpenThinking"
          />
        </div>

        <!-- 思考步骤侧栏：数据来自 chat.steps，由 showStepsForMessage / handleSse 驱动 -->
        <aside
          v-if="panelVisible"
          class="steps"
          :class="{ 'steps-drawer': isCompact, open: stepsOpen || !isCompact }"
        >
          <div class="steps-head">
            <div class="steps-title-row">
              <span class="steps-status-icon" :class="{ spin: stepsRunning }">
                {{ stepsRunning ? '⟳' : '✓' }}
              </span>
              <div class="steps-title">{{ stepsPanelTitle }}</div>
            </div>
            <a-button type="text" size="small" class="steps-close" @click="closeStepsPanel">✕</a-button>
          </div>
          <a-timeline>
            <a-timeline-item
              v-for="s in chat.steps"
              :key="s.id"
              :color="s.status === 'error' ? 'red' : s.status === 'done' ? 'green' : 'blue'"
            >
              <div class="step-row">
                <span
                  class="step-status"
                  :class="{
                    done: s.status === 'done',
                    error: s.status === 'error',
                    running: s.status !== 'done' && s.status !== 'error',
                  }"
                >
                  {{ s.status === 'error' ? '!' : s.status === 'done' ? '✓' : '⟳' }}
                </span>
                <div>
                  <div class="step-title">{{ s.title }}</div>
                  <div class="step-detail" v-if="s.detail">{{ s.detail }}</div>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
        </aside>
      </div>

      <div v-if="chat.pendingConfirm" class="confirm-bar">
        <div>需要确认工具调用</div>
        <pre>{{ JSON.stringify(chat.pendingConfirm, null, 2) }}</pre>
        <a-space wrap>
          <a-button type="primary" @click="chat.answerConfirm(true)">允许</a-button>
          <a-button danger @click="chat.answerConfirm(false)">拒绝</a-button>
        </a-space>
      </div>

      <footer class="composer">
        <div v-if="chat.attachments.length" class="attach-row">
          <div v-for="a in chat.attachments" :key="a.path" class="attach-chip">
            <img v-if="a.previewUrl" class="attach-chip-thumb" :src="a.previewUrl" :alt="a.name" />
            <span v-else class="attach-chip-icon">📄</span>
            <span class="attach-chip-name" :title="a.name || a.path">{{ a.name || fileLabel(a.path) }}</span>
            <button type="button" class="attach-chip-close" @click="chat.removeAttachment(a.path)">
              ✕
            </button>
          </div>
        </div>
        <div class="composer-card">
          <a-textarea
            v-model:value="draft"
            :auto-size="{ minRows: 2, maxRows: isTiny ? 4 : 6 }"
            placeholder="输入消息，⌘/Ctrl + Enter 发送"
            :disabled="chat.busy"
            @keydown="onKeydown"
          />
          <div class="actions">
            <a-upload :show-upload-list="false" :before-upload="onUpload" multiple>
              <a-button>附件</a-button>
            </a-upload>
            <a-button v-if="chat.busy" @click="chat.stop()">停止</a-button>
            <a-button type="primary" :disabled="!canSend" :loading="chat.busy" @click="onSend">
              发送
            </a-button>
          </div>
        </div>
        <div class="hint">{{ chat.statusText || '⌘↩ / Ctrl↩ 发送' }}</div>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * 主聊天页：三栏布局（会话侧栏 / 消息区 / 思考步骤侧栏）。
 *
 * 协作：useChatStore（消息/SSE/步骤）、useAuthStore（用户/健康检查）、
 * ChatBubble（单条渲染）、window.api（Electron 选目录/打开目录）。
 * 响应式断点控制侧栏与步骤面板在窄屏下改为抽屉。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { MenuOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import ChatBubble from '../components/ChatBubble.vue'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useLicenseStore } from '../stores/license'

const auth = useAuthStore()
const chat = useChatStore()
const license = useLicenseStore()
const router = useRouter()
const draft = ref('')
const scrollEl = ref<HTMLElement | null>(null)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const sidebarOpen = ref(false)
/** 思考步骤侧栏是否展开（窄屏为抽屉，宽屏为固定右栏） */
const stepsOpen = ref(false)

const isNarrow = computed(() => viewportWidth.value < 1100)
const isCompact = computed(() => viewportWidth.value < 1280)
const isTiny = computed(() => viewportWidth.value < 760)

const scopeOptions = computed(() =>
  isTiny.value
    ? [
        { label: '沙箱', value: 'sandbox' },
        { label: '完全', value: 'full' },
        { label: '受限', value: 'restricted' },
      ]
    : [
        { label: '沙箱', value: 'sandbox' },
        { label: '完全访问', value: 'full' },
        { label: '受限访问', value: 'restricted' },
      ],
)

const canSend = computed(
  () =>
    license.isActivated &&
    !chat.busy &&
    (Boolean(draft.value.trim()) || chat.attachments.length > 0),
)
const hasSteps = computed(() => chat.steps.length > 0)
const panelVisible = computed(() => stepsOpen.value && (hasSteps.value || chat.busy))
const showStepsToggle = computed(() => (hasSteps.value || chat.busy) && isCompact.value)
const stepsRunning = computed(() => {
  if (chat.busy && chat.activeMessageId) {
    const msg = chat.messages.find((m) => m.id === chat.activeMessageId)
    if (msg?.streaming) return true
  }
  return chat.steps.some((s) => s.status !== 'done' && s.status !== 'error')
})
const stepsPanelTitle = computed(() => {
  if (stepsRunning.value) {
    const running = [...chat.steps].reverse().find((s) => s.status !== 'done' && s.status !== 'error')
    return running?.title || chat.statusText || '思考中…'
  }
  return '已完成思考'
})

const shortWorkRoot = computed(() => {
  if (chat.workRoot) {
    const p = chat.workRoot
    if (p.length <= 28 || !isCompact.value) return p
    return `…${p.slice(-24)}`
  }
  if (chat.accessScope === 'full') return '未选择（默认主目录）'
  if (chat.accessScope === 'restricted') return '未选择（请先选目录）'
  return '沙箱 docs'
})

const workRootHint = computed(() => {
  if (chat.workRoot) return chat.workRoot
  if (chat.accessScope === 'full') {
    return '未选择工作根时，完全访问默认使用用户主目录（含桌面）'
  }
  if (chat.accessScope === 'restricted') {
    return '受限访问请先点「选目录」，否则只能操作空的 fallback 目录'
  }
  return '沙箱模式固定使用 workspace/docs'
})

function onOpenThinking(messageId: string): void {
  // 再次点击同一条消息的「思考」pill → 收起侧栏
  if (stepsOpen.value && chat.activeMessageId === messageId) {
    closeStepsPanel()
    return
  }
  chat.showStepsForMessage(messageId)
  stepsOpen.value = true
}

function closeStepsPanel(): void {
  stepsOpen.value = false
  if (!chat.busy) chat.clearActiveSteps()
}

/** 顶栏「步骤」按钮：无选中消息时默认打开最后一条 assistant 的思考 */
function toggleStepsPanel(): void {
  if (stepsOpen.value) {
    closeStepsPanel()
    return
  }
  if (!chat.activeMessageId) {
    const last = [...chat.messages].reverse().find((m) => m.role === 'assistant' && (m.steps?.length || m.streaming))
    if (last) chat.showStepsForMessage(last.id)
  }
  stepsOpen.value = true
}

function fileLabel(path: string): string {
  const parts = (path || '').replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path || '附件'
}

function onResize(): void {
  viewportWidth.value = window.innerWidth
  if (!isNarrow.value) sidebarOpen.value = false
}

async function scrollBottom(): Promise<void> {
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

watch(
  () => [chat.messages.length, chat.messages.at(-1)?.content],
  () => {
    void scrollBottom()
  },
)

watch(
  () => chat.busy,
  (busy) => {
    // 开始流式输出时自动展开思考侧栏
    if (busy && chat.activeMessageId) stepsOpen.value = true
  },
)

onMounted(async () => {
  onResize()
  window.addEventListener('resize', onResize)
  await auth.checkHealth()
  try {
    await chat.refreshSessions()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载会话失败')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

async function onNewChat(): Promise<void> {
  await chat.newSession()
  if (isNarrow.value) sidebarOpen.value = false
}

async function onOpenSession(id: string): Promise<void> {
  await chat.openSession(id)
  stepsOpen.value = false
  if (isNarrow.value) sidebarOpen.value = false
}

async function onDeleteSession(id: string): Promise<void> {
  // 删除逻辑在 chat.removeSession：调 API、更新列表、若删当前会话则切到其它会话
  try {
    await chat.removeSession(id)
    message.success('已删除对话')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败')
  }
}

function onLogout(): void {
  auth.logout()
  router.replace({ name: 'login' })
}

async function reconnect(): Promise<void> {
  const ok = await auth.checkHealth()
  if (ok) {
    await chat.refreshSessions()
    message.success('已重连')
  } else {
    message.error(auth.error || '重连失败')
  }
}

async function pickDir(): Promise<void> {
  if (!window.api?.selectDirectory) {
    message.warning('当前环境不支持选目录（请用 Electron 运行）')
    return
  }
  const path = await window.api.selectDirectory()
  if (path) chat.workRoot = path
}

async function openDir(): Promise<void> {
  if (chat.workRoot && window.api?.openPath) {
    await window.api.openPath(chat.workRoot)
  }
}

async function onUpload(file: File): Promise<boolean> {
  try {
    await chat.uploadLocalFile(file)
    message.success(`已添加 ${file.name}`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '上传失败')
  }
  return false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    void onSend()
  }
}

async function onSend(): Promise<void> {
  if (!license.isActivated) {
    message.warning('请先激活软件后再对话')
    router.replace({ name: 'activate' })
    return
  }
  const text = draft.value
  draft.value = ''
  await chat.send(text)
}
</script>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 20;
}

.sidebar {
  background: #151a22;
  border-right: 1px solid #243041;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  z-index: 30;
}

.side-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.app-name {
  font-size: clamp(18px, 2vw, 22px);
  font-weight: 700;
}
.app-sub {
  color: #8b93a1;
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
.new-btn {
  height: 40px;
  font-weight: 600;
}
.side-label {
  color: #8b93a1;
  font-size: 12px;
  margin-top: 4px;
}
.session-list {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.session-item {
  padding: 10px 8px 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.session-main {
  flex: 1;
  min-width: 0;
}
.session-item:hover {
  background: #1c2330;
}
.session-item.active {
  background: #2f8f6e;
}
.session-item .title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-item .meta {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 2px;
}
.del-btn {
  opacity: 0.55;
  flex-shrink: 0;
}
.session-item:hover .del-btn,
.session-item.active .del-btn {
  opacity: 1;
}
.session-item.active .del-btn {
  color: #fff !important;
}
.side-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.footer-toggles {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  min-width: 0;
  min-height: 0;
  background: #0e1116;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 12px;
  background: #151a22;
  border-bottom: 1px solid #243041;
  min-width: 0;
}
.top-left,
.top-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.icon-btn {
  color: #e8eaed !important;
  padding: 0 6px !important;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c45c5c;
  display: inline-block;
  flex-shrink: 0;
}
.dot.on {
  background: #2f8f6e;
}
.status {
  font-size: 12px;
  color: #8b93a1;
  white-space: nowrap;
}
.scope-seg {
  max-width: 100%;
}
.work-root {
  max-width: min(280px, 32vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}

.content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  position: relative;
}
.messages {
  overflow: auto;
  padding: clamp(12px, 2vw, 20px) clamp(10px, 1.5vw, 16px);
  min-width: 0;
}
.hero {
  text-align: center;
  padding-top: clamp(48px, 12vh, 120px);
  color: #8b93a1;
  padding-inline: 12px;
}
.hero h2 {
  color: #e8eaed;
  margin: 0 0 8px;
  font-size: clamp(22px, 3vw, 28px);
}

.steps {
  width: min(280px, 32vw);
  min-width: 220px;
  border-left: 1px solid #243041;
  background: #151a22;
  padding: 14px;
  overflow: auto;
  min-height: 0;
}
.steps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.steps-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.steps-status-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  background: #2f8f6e;
  color: #fff;
  flex-shrink: 0;
}
.steps-status-icon.spin {
  background: #3a6ea5;
  animation: spin 1s linear infinite;
}
.steps-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.steps-close {
  color: #8b93a1 !important;
  flex-shrink: 0;
}
.step-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.step-status {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
  margin-top: 2px;
  background: #3a6ea5;
  color: #fff;
}
.step-status.done {
  background: #2f8f6e;
}
.step-status.error {
  background: #c45c5c;
}
.step-status.running {
  animation: spin 1s linear infinite;
}
.step-title {
  font-size: 13px;
}
.step-detail {
  font-size: 12px;
  color: #8b93a1;
  margin-top: 2px;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.confirm-bar {
  margin: 0 12px 8px;
  padding: 12px;
  border-radius: 12px;
  background: #3a2a1e;
  color: #f0d9b5;
  min-width: 0;
}
.confirm-bar pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  max-height: 120px;
  overflow: auto;
}

.composer {
  padding: 10px clamp(10px, 1.5vw, 16px) 12px;
  background: #151a22;
  border-top: 1px solid #243041;
  min-width: 0;
}
.attach-row {
  margin-bottom: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(360px, 90vw);
  padding: 6px 8px 6px 10px;
  border-radius: 10px;
  border: 1px solid #3a4454;
  background: #1c2330;
  color: #e8eaed;
  font-size: 12px;
}
.attach-chip-thumb {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.attach-chip-icon {
  flex-shrink: 0;
  line-height: 1;
}
.attach-chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e8eaed;
}
.attach-chip-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #8b93a1;
  cursor: pointer;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
}
.attach-chip-close:hover {
  color: #e8eaed;
}
.composer-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  background: #1c2330;
  border: 1px solid #2f8f6e55;
  border-radius: 16px;
  padding: 12px;
  min-width: 0;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hint {
  text-align: right;
  color: #8b93a1;
  font-size: 11px;
  margin-top: 6px;
}

/* ≤1280：步骤面板改为抽屉 */
@media (max-width: 1279px) {
  .steps.steps-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(320px, 86vw);
    min-width: 0;
    z-index: 40;
    transform: translateX(105%);
    transition: transform 0.2s ease;
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);
    border-left: 1px solid #243041;
  }
  .steps.steps-drawer.open {
    transform: translateX(0);
  }
  .content {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ≤1100：侧栏抽屉化 */
@media (max-width: 1099px) {
  .chat-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(300px, 88vw);
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    box-shadow: 8px 0 24px rgba(0, 0, 0, 0.35);
  }
  .sidebar:not(.collapsed),
  .chat-layout.sidebar-open .sidebar {
    transform: translateX(0);
  }
  .sidebar.collapsed {
    transform: translateX(-105%);
    pointer-events: none;
  }
}

/* ≤760：顶栏与输入区进一步压缩 */
@media (max-width: 759px) {
  .composer-card {
    grid-template-columns: 1fr;
  }
  .actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .work-root {
    max-width: 42vw;
  }
  .status {
    max-width: 40vw;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
