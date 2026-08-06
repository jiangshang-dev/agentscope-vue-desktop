/**
 * Preload 脚本：在隔离的渲染上下文中暴露安全的桌面 API。
 *
 * 通过 contextBridge 挂载 window.api，供 Vue 渲染层调用；
 * 实际能力由 main/index.ts 的 ipcMain.handle 实现。
 */
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:selectFiles'),
  openPath: (targetPath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', targetPath),
}

contextBridge.exposeInMainWorld('api', api)
