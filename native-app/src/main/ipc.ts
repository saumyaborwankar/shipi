import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/ipc';
import * as fsService from './fsService';
import { getVaultName, getVaultRoot } from './vault';
import {
  getSyncStatus,
  syncGoogleSignIn,
  syncNow,
  syncPush,
  syncSignIn,
  syncSignOut,
  syncSignUp,
} from './sync';

export function registerIpc(): void {
  ipcMain.handle(IPC.vaultInfo, () => ({
    rootPath: getVaultRoot(),
    name: getVaultName(),
  }));

  ipcMain.handle(IPC.vaultTree, () => fsService.buildTree());

  ipcMain.handle(IPC.fsRead, (_e, relPath: string) => fsService.readFile(relPath));

  ipcMain.handle(IPC.fsWrite, (_e, relPath: string, content: string) => {
    fsService.writeFile(relPath, content);
  });

  ipcMain.handle(IPC.fsCreateFile, (_e, parentRelPath: string | null, name: string) =>
    fsService.createFile(parentRelPath, name),
  );

  ipcMain.handle(IPC.fsCreateFolder, (_e, parentRelPath: string | null, name: string) =>
    fsService.createFolder(parentRelPath, name),
  );

  ipcMain.handle(IPC.fsRename, (_e, relPath: string, newName: string) =>
    fsService.renameEntry(relPath, newName),
  );

  ipcMain.handle(IPC.fsDelete, (_e, relPath: string) => {
    fsService.deleteEntry(relPath);
  });

  ipcMain.handle(IPC.syncStatus, () => getSyncStatus());

  ipcMain.handle(IPC.syncSignUp, (_e, email: string, password: string) =>
    syncSignUp(email, password),
  );

  ipcMain.handle(IPC.syncSignIn, (_e, email: string, password: string) =>
    syncSignIn(email, password),
  );

  ipcMain.handle(IPC.syncGoogleSignIn, () => syncGoogleSignIn());

  ipcMain.handle(IPC.syncSignOut, () => syncSignOut());

  ipcMain.handle(IPC.syncNow, () => syncNow());

  ipcMain.handle(IPC.syncPush, () => syncPush());

  ipcMain.handle(IPC.windowIsMaximized, (e) =>
    BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false,
  );

  ipcMain.on(IPC.windowMinimize, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });

  ipcMain.on(IPC.windowToggleMaximize, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) {
      return;
    }
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on(IPC.windowClose, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
}
