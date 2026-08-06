import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

/** 打包时写入主进程；签发密钥须使用同一 LICENSE_HMAC_SECRET */
const licenseSecret =
  process.env.LICENSE_HMAC_SECRET || 'agentscope-desktop-dev-secret-change-me'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __LICENSE_HMAC_SECRET__: JSON.stringify(licenseSecret),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [vue()],
    server: {
      port: 5173,
    },
  },
})
