import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config: Record<string, string>) => ipcRenderer.invoke('save-config', config),
  testWallpaper: () => ipcRenderer.invoke('test-wallpaper'),
  openImagesFolder: () => ipcRenderer.invoke('open-images-folder'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  isDevMode: () => ipcRenderer.invoke('is-dev-mode'),
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      loadConfig: () => Promise<Record<string, string> | null>;
      saveConfig: (config: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
      testWallpaper: () => Promise<{ success: boolean; error?: string }>;
      openImagesFolder: () => Promise<{ success: boolean; error?: string }>;
      checkForUpdates: () => Promise<any>;
      installUpdate: () => Promise<{ success: boolean; error?: string }>;
      getVersion: () => Promise<string>;
      isDevMode: () => Promise<boolean>;
    };
  }
}

