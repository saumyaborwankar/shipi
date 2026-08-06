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
