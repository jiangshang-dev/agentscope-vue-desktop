<template>
  <div class="row" :class="message.role">
    <div class="msg-stack">
      <!-- 用户附件：放在文字气泡上方（参考图：文件/图片与提问同属一条消息） -->
      <div v-if="message.attachments?.length" class="attach-list" :class="message.role">
        <div v-for="a in message.attachments" :key="a.path" class="attach-item">
          <img v-if="a.previewUrl" class="attach-thumb" :src="a.previewUrl" :alt="a.name" />
          <div v-else class="attach-file">
            <span class="attach-file-icon">📄</span>
            <span class="attach-file-name" :title="a.name">{{ a.name }}</span>
          </div>
        </div>
      </div>

      <div class="bubble">
        <div class="who">
          <span class="dot" />
          {{ message.role === 'user' ? '你' : '助手' }}
        </div>

        <button
          v-if="showThinking"
          type="button"
          class="think-pill"
          :class="{ active: active, running: isRunning }"
          @click="$emit('open-thinking', message.id)"
        >
          <span class="think-icon" :class="{ spin: isRunning }">⚙</span>
          <span class="think-label">{{ thinkLabel }}</span>
          <span class="think-arrow">›</span>
        </button>

        <div
          v-if="message.role === 'assistant' || message.role === 'system'"
          class="md"
          v-html="html"
        />
        <div v-else class="text">{{ displayText }}</div>
        <a-spin v-if="message.streaming && !showThinking" size="small" style="margin-top: 8px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 单条聊天气泡：用户纯文本 + 附件卡片，助手 Markdown。
 * 助手且有 steps 或正在 streaming 时显示「思考」pill，点击 emit open-thinking 由 ChatView 打开侧栏。
 */
import { computed } from 'vue'
import type { ChatMessage } from '../api/types'
import { renderMarkdown } from '../utils/markdown'

const props = defineProps<{
  message: ChatMessage
  active?: boolean
}>()

defineEmits<{
  'open-thinking': [messageId: string]
}>()

const hasSteps = computed(() => (props.message.steps?.length || 0) > 0)
const isRunning = computed(() => Boolean(props.message.streaming))
const isAwaitingConfirm = computed(() => Boolean(props.message.awaitingConfirm))
/** 有历史步骤或仍在流式 / 等待确认时展示思考入口 */
const showThinking = computed(
  () =>
    props.message.role === 'assistant' &&
    (hasSteps.value || isRunning.value || isAwaitingConfirm.value),
)

const thinkLabel = computed(() => {
  if (isAwaitingConfirm.value) return '等待确认工具…'
  if (isRunning.value) {
    const steps = props.message.steps || []
    const running = [...steps].reverse().find((s) => s.status !== 'done' && s.status !== 'error')
    const last = steps[steps.length - 1]
    return running?.title || last?.title || '思考中…'
  }
  return '已完成思考'
})

const displayText = computed(() => {
  if (!props.message.content) {
    if (props.message.streaming) return ''
    if (props.message.awaitingConfirm) return '需要确认工具调用后继续…'
    return '（无回复）'
  }
  return props.message.content
})

const html = computed(() => {
  if (!props.message.content) {
    if (props.message.streaming) return ''
    if (props.message.awaitingConfirm) {
      return renderMarkdown('*需要确认工具调用后继续…*')
    }
    return renderMarkdown('（无回复）')
  }
  return renderMarkdown(props.message.content)
})
</script>

<style scoped>
.row {
  display: flex;
  margin-bottom: 14px;
}
.row.user {
  justify-content: flex-end;
}
.row.assistant,
.row.system {
  justify-content: flex-start;
}
.msg-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  max-width: min(720px, 92%);
  min-width: 0;
}
.row.user .msg-stack {
  align-items: flex-end;
}
.row.assistant .msg-stack,
.row.system .msg-stack {
  align-items: flex-start;
}
.attach-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
}
.attach-list.user {
  align-items: flex-end;
}
.attach-thumb {
  display: block;
  max-width: min(280px, 70vw);
  max-height: 180px;
  border-radius: 10px;
  border: 1px solid #3a4454;
  object-fit: cover;
  background: #1c2330;
}
.attach-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(320px, 80vw);
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #3a4454;
  background: #1c2330;
  color: #e8eaed;
  font-size: 12px;
}
.user .attach-file {
  background: #234a3c;
  border-color: #2f8f6e66;
  color: #e8f7f1;
}
.attach-file-icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1;
}
.attach-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bubble {
  max-width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  line-height: 1.55;
  min-width: 0;
}
.user .bubble {
  background: #2a6b56;
  color: #e8f7f1;
}
.assistant .bubble,
.system .bubble {
  background: #1c2330;
  border: 1px solid #2a3344;
  color: #e8eaed;
}
.who {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.8;
  margin-bottom: 6px;
  font-weight: 600;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2f8f6e;
  display: inline-block;
}
.user .dot {
  background: #fff;
}
.think-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid #3a4454;
  background: rgba(0, 0, 0, 0.22);
  color: #c5ccd6;
  font-size: 12px;
  cursor: pointer;
  max-width: 100%;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.think-pill:hover,
.think-pill.active {
  border-color: #2f8f6e;
  color: #e8eaed;
  background: rgba(47, 143, 110, 0.12);
}
.think-pill.running {
  border-color: #4a7ab0;
}
.think-icon {
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  opacity: 0.85;
  flex-shrink: 0;
}
.think-icon.spin {
  animation: spin 1s linear infinite;
  color: #6eb0e8;
}
.think-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}
.think-arrow {
  opacity: 0.7;
  flex-shrink: 0;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.text {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-size: clamp(13px, 1.4vw, 14px);
}
.md {
  font-size: clamp(13px, 1.4vw, 14px);
  word-break: break-word;
  overflow-wrap: anywhere;
}
.md:empty {
  display: none;
}
.md :deep(p) {
  margin: 0 0 0.65em;
}
.md :deep(p:last-child) {
  margin-bottom: 0;
}
.md :deep(ul),
.md :deep(ol) {
  margin: 0.4em 0 0.7em;
  padding-left: 1.35em;
}
.md :deep(li) {
  margin: 0.2em 0;
}
.md :deep(strong) {
  font-weight: 700;
  color: #fff;
}
.md :deep(hr) {
  border: none;
  border-top: 1px solid #3a4454;
  margin: 0.9em 0;
}
.md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.28);
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.md :deep(pre) {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid #2a3344;
  border-radius: 10px;
  padding: 10px 12px;
  overflow: auto;
  margin: 0.6em 0;
}
.md :deep(pre code) {
  background: transparent;
  padding: 0;
}
.md :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.2em 0 0.2em 0.9em;
  border-left: 3px solid #2f8f6e;
  color: #c5ccd6;
}
.md :deep(a) {
  color: #6ec9a8;
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4) {
  margin: 0.8em 0 0.4em;
  line-height: 1.3;
  font-weight: 700;
}
.md :deep(h1) {
  font-size: 1.25em;
}
.md :deep(h2) {
  font-size: 1.15em;
}
.md :deep(h3),
.md :deep(h4) {
  font-size: 1.05em;
}
.md :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.6em 0;
  font-size: 0.92em;
}
.md :deep(th),
.md :deep(td) {
  border: 1px solid #3a4454;
  padding: 6px 8px;
  text-align: left;
}

@media (max-width: 759px) {
  .msg-stack {
    max-width: 96%;
  }
  .think-label {
    max-width: 56vw;
  }
}
</style>
