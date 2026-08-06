<template>
  <div class="row" :class="message.role">
    <div class="bubble">
      <div class="who">
        <span class="dot" />
        {{ message.role === 'user' ? '你' : '助手' }}
      </div>
      <div class="text">{{ displayText }}</div>
      <a-spin v-if="message.streaming" size="small" style="margin-top: 8px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '../api/types'

const props = defineProps<{ message: ChatMessage }>()

const displayText = computed(() => {
  if (!props.message.content) {
    return props.message.streaming ? '思考中…' : '（无回复）'
  }
  return props.message.content
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
.bubble {
  max-width: min(720px, 92%);
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
.text {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-size: clamp(13px, 1.4vw, 14px);
}

@media (max-width: 759px) {
  .bubble {
    max-width: 96%;
  }
}
</style>
