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
}
