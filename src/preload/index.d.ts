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
