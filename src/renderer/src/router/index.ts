/**
 * 前端路由与鉴权守卫。
 *
 * 使用 hash 模式（Electron file:// 兼容）；meta.public 标记免登录页。
 * 对话页需：已登录 + 已激活密钥。
 * 与 stores/auth.ts、stores/license.ts 配合。
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/activate',
      name: 'activate',
      component: () => import('../views/ActivateView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const license = useLicenseStore()

  if (!license.ready) {
    await license.refresh()
  }

  // 受保护路由：先登录
  if (!to.meta.public && !auth.isAuthed) return { name: 'login' }

  // 对话功能需激活密钥
  if (to.name === 'chat' && !license.isActivated) {
    return { name: 'activate' }
  }

  // 已激活不必再看激活页
  if (to.name === 'activate' && license.isActivated) {
    return { name: auth.isAuthed ? 'chat' : 'login' }
  }

  // 已登录用户不必再看登录页
  if (to.name === 'login' && auth.isAuthed) {
    return { name: license.isActivated ? 'chat' : 'activate' }
  }

  return true
})

export default router
