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

export interface SyncFileEntry {
  serverId: string;
  versionNo: number;
  localSha256: string;
}

export interface SyncStatus {
  signedIn: boolean;
  email: string | null;
  vaultId: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
  message: string | null;
}

export interface Envelope {
  iv: string;
  authTag: string;
  data: string;
}
