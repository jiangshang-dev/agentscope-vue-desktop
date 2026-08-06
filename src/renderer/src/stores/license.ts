/**
 * 激活密钥状态（Pinia）。
 *
 * 通过 window.api 调主进程 HMAC 校验；未激活时路由守卫拦截对话页。
 * 浏览器预览（无 Electron）下视为已激活，避免纯 web 调试被挡。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LicenseStatusDto } from '../../../preload/index.d'

const empty: LicenseStatusDto = {
  activated: false,
  plan: '',
  uid: '',
  exp: null,
  expLabel: '',
  machineId: '',
  message: '未激活',
}

function hasDesktopLicenseApi(): boolean {
  return typeof window !== 'undefined' && typeof window.api?.licenseStatus === 'function'
}

export const useLicenseStore = defineStore('license', () => {
  const status = ref<LicenseStatusDto>({ ...empty })
  const loading = ref(false)
  const error = ref('')
  const ready = ref(false)

  const isActivated = computed(() => {
    // 非 Electron（如 vite 单独预览）不强制激活
    if (!hasDesktopLicenseApi()) return true
    return Boolean(status.value.activated)
  })

  async function refresh(): Promise<LicenseStatusDto> {
    if (!hasDesktopLicenseApi()) {
      status.value = {
        ...empty,
        activated: true,
        plan: 'dev',
        message: '开发预览（无 Electron 激活 API）',
      }
      ready.value = true
      return status.value
    }
    loading.value = true
    error.value = ''
    try {
      status.value = await window.api.licenseStatus()
      return status.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : '读取激活状态失败'
      status.value = { ...empty, message: error.value }
      return status.value
    } finally {
      loading.value = false
      ready.value = true
    }
  }

  async function activate(key: string): Promise<LicenseStatusDto> {
    if (!hasDesktopLicenseApi()) {
      throw new Error('当前环境不支持激活（请在 Electron 客户端中操作）')
    }
    loading.value = true
    error.value = ''
    try {
      const next = await window.api.licenseActivate(key)
      status.value = next
      if (!next.activated) {
        error.value = next.message || '激活失败'
      }
      return next
    } catch (e) {
      error.value = e instanceof Error ? e.message : '激活失败'
      throw e
    } finally {
      loading.value = false
      ready.value = true
    }
  }

  async function deactivate(): Promise<void> {
    if (!hasDesktopLicenseApi()) return
    status.value = await window.api.licenseDeactivate()
  }

  return {
    status,
    loading,
    error,
    ready,
    isActivated,
    refresh,
    activate,
    deactivate,
  }
})
