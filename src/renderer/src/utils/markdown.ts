/**
 * 助手回复 Markdown → 安全 HTML。
 * marked 解析 GFM；DOMPurify 消毒后供 ChatBubble v-html 使用，防止 XSS。
 */
import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(source: string): string {
  const raw = (source || '').trim()
  if (!raw) return ''
  const html = marked.parse(raw, { async: false }) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })
}
