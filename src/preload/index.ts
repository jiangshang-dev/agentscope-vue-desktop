import { contextBridge, ipcRenderer } from 'electron'

const api = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:selectFiles'),
  openPath: (targetPath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', targetPath),
}

contextBridge.exposeInMainWorld('api', api)
