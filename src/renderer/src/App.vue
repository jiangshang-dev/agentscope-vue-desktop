<template>
  <a-config-provider :theme="antdTheme" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
/**
 * 应用根组件：Ant Design 深色主题 + 中文 locale，router-view 承载 Login/Chat 页面。
 * 与 router/index.ts（路由守卫）、各 view 协作，本身不含业务状态。
 */
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { theme, type ThemeConfig } from 'ant-design-vue'

const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#2f8f6e',
    colorBgBase: '#0e1116',
    colorBgContainer: '#151a22',
    borderRadius: 10,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif',
  },
}
</script>
