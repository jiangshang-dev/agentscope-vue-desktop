/**
 * Electron 主进程入口。
 *
 * 职责：创建 BrowserWindow、加载渲染页（开发走 Vite URL，生产走打包 HTML）、
 * 注册 IPC 供 preload 桥接（选目录/选文件/用系统打开路径/激活密钥）。
 *
 * 协作：preload/index.ts 通过 ipcRenderer.invoke 调用本文件注册的 handler；
 * 渲染进程不直接访问 Node/Electron API。
 */
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import {
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
} from './license'

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 520,
    minHeight: 480,
    show: false,
    title: 'AgentOS',
    backgroundColor: '#0e1116',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 页面内 target=_blank 等外链统一用系统浏览器打开，不在 Electron 内嵌
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.agentscope.desktop')
  }

  // --- IPC：供 ChatView 选择工作根目录、附件等 ---
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:selectFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Documents',
          extensions: [
            'txt',
            'md',
            'pdf',
            'doc',
            'docx',
            'ppt',
            'pptx',
            'xls',
            'xlsx',
            'csv',
            'json',
          ],
        },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
        { name: 'All', extensions: ['*'] },
      ],
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle('shell:openPath', async (_e, targetPath: string) => {
    if (!targetPath) return 'empty'
    return shell.openPath(targetPath)
  })

  // --- IPC：激活密钥（主进程校验，渲染层不可伪造签名） ---
  ipcMain.handle('license:status', async () => getLicenseStatus())
  ipcMain.handle('license:activate', async (_e, key: string) => activateLicense(String(key || '')))
  ipcMain.handle('license:deactivate', async () => deactivateLicense())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
