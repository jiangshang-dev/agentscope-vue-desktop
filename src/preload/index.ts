/**
 * Preload 脚本：在隔离的渲染上下文中暴露安全的桌面 API。
 *
 * 通过 contextBridge 挂载 window.api，供 Vue 渲染层调用；
 * 实际能力由 main/index.ts 的 ipcMain.handle 实现。
 */
import { contextBridge, ipcRenderer } from 'electron'

export type LicenseStatusDto = {
  activated: boolean
  plan: string
  uid: string
  exp: number | null
  expLabel: string
  machineId: string
  message: string
}

const api = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:selectFiles'),
  openPath: (targetPath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', targetPath),
  licenseStatus: (): Promise<LicenseStatusDto> => ipcRenderer.invoke('license:status'),
  licenseActivate: (key: string): Promise<LicenseStatusDto> =>
    ipcRenderer.invoke('license:activate', key),
  licenseDeactivate: (): Promise<LicenseStatusDto> => ipcRenderer.invoke('license:deactivate'),
}

contextBridge.exposeInMainWorld('api', api)
