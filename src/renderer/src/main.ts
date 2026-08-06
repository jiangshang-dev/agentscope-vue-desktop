/**
 * Vue 渲染进程入口。
 * 挂载 Pinia、Vue Router、Ant Design Vue，并加载全局样式。
 * 根组件 App.vue 仅负责主题与路由出口，业务在 views/ 与 stores/。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)
app.mount('#app')
