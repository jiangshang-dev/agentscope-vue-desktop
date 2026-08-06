/**
 * window.api 的 TypeScript 声明，与 preload/index.ts 暴露的方法一一对应。
 * 渲染进程通过 import 本文件获得类型提示，运行时数据来自 preload 注入。
 */
export interface DesktopApi {
  selectDirectory: () => Promise<string | null>
  selectFiles: () => Promise<string[]>
  openPath: (targetPath: string) => Promise<string>
}

declare global {
  interface Window {
    api: DesktopApi
  }
}

export {}
