import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC, ShipiApi } from './shared/ipc';

const api: ShipiApi = {
  vaultInfo: () => ipcRenderer.invoke(IPC.vaultInfo),
  vaultTree: () => ipcRenderer.invoke(IPC.vaultTree),
  readFile: (relPath) => ipcRenderer.invoke(IPC.fsRead, relPath),
  writeFile: (relPath, content) => ipcRenderer.invoke(IPC.fsWrite, relPath, content),
  createFile: (parentRelPath, name) => ipcRenderer.invoke(IPC.fsCreateFile, parentRelPath, name),
  createFolder: (parentRelPath, name) =>
    ipcRenderer.invoke(IPC.fsCreateFolder, parentRelPath, name),
  rename: (relPath, newName) => ipcRenderer.invoke(IPC.fsRename, relPath, newName),
  deleteEntry: (relPath) => ipcRenderer.invoke(IPC.fsDelete, relPath),
  minimize: () => ipcRenderer.send(IPC.windowMinimize),
  toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
  close: () => ipcRenderer.send(IPC.windowClose),
  isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
  onMaximizeChange: (cb) => {
    const listener = (_e: IpcRendererEvent, maximized: boolean): void => cb(maximized);
    ipcRenderer.on(IPC.windowMaximizeChange, listener);
    return () => {
      ipcRenderer.removeListener(IPC.windowMaximizeChange, listener);
    };
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('shipi', api);
