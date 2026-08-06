/**
 * 前端路由与鉴权守卫。
 *
 * 使用 hash 模式（Electron file:// 兼容）；meta.public 标记免登录页。
 * 未登录访问 / 会重定向 login；已登录访问 login 会重定向 chat。
 * 与 stores/auth.ts 的 isAuthed、api/client 的 token 持久化配合。
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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
      path: '/',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  // 受保护路由：无 token 则去登录
  if (!to.meta.public && !auth.isAuthed) return { name: 'login' }
  // 已登录用户不必再看登录页
  if (to.name === 'login' && auth.isAuthed) return { name: 'chat' }
  return true
})

export default router
