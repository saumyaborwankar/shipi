export interface FileNode {
  name: string;
  relPath: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export interface VaultInfo {
  rootPath: string;
  name: string;
}

import type { SyncStatus } from './sync';

export const IPC = {
  vaultInfo: 'shipi:vault:info',
  vaultTree: 'shipi:vault:tree',
  fsRead: 'shipi:fs:read',
  fsWrite: 'shipi:fs:write',
  fsCreateFile: 'shipi:fs:create-file',
  fsCreateFolder: 'shipi:fs:create-folder',
  fsRename: 'shipi:fs:rename',
  fsDelete: 'shipi:fs:delete',
  windowMinimize: 'shipi:window:minimize',
  windowToggleMaximize: 'shipi:window:toggle-maximize',
  windowClose: 'shipi:window:close',
  windowIsMaximized: 'shipi:window:is-maximized',
  windowMaximizeChange: 'shipi:window:maximize-change',
  syncStatus: 'shipi:sync:status',
  syncSignUp: 'shipi:sync:sign-up',
  syncSignIn: 'shipi:sync:sign-in',
  syncSignOut: 'shipi:sync:sign-out',
  syncNow: 'shipi:sync:now',
  syncPush: 'shipi:sync:push',
  syncStateChange: 'shipi:sync:state-change',
} as const;

export interface ShipiApi {
  vaultInfo: () => Promise<VaultInfo>;
  vaultTree: () => Promise<FileNode[]>;
  readFile: (relPath: string) => Promise<string>;
  writeFile: (relPath: string, content: string) => Promise<void>;
  createFile: (parentRelPath: string | null, name: string) => Promise<string>;
  createFolder: (parentRelPath: string | null, name: string) => Promise<string>;
  rename: (relPath: string, newName: string) => Promise<string>;
  deleteEntry: (relPath: string) => Promise<void>;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void;
  platform: string;
  syncStatus: () => Promise<SyncStatus>;
  syncSignUp: (email: string, password: string) => Promise<SyncStatus>;
  syncSignIn: (email: string, password: string) => Promise<SyncStatus>;
  syncSignOut: () => Promise<SyncStatus>;
  syncNow: () => Promise<SyncStatus>;
  syncPush: () => Promise<SyncStatus>;
  onSyncStateChange: (cb: (status: SyncStatus) => void) => () => void;
}
