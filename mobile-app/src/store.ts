import { create } from 'zustand';
import type { FileNode, SyncStatus, VaultInfo } from './lib/types';
import * as syncLib from './lib/sync';
import { buildTree, ensureVault, getVaultName, getVaultRootPath, readFile, writeFile } from './lib/vault';

interface ShipiState {
  vault: VaultInfo | null;
  tree: FileNode[];
  selectedPath: string | null;
  content: string;
  dirty: boolean;
  expanded: Record<string, boolean>;
  sync: SyncStatus;
  ready: boolean;
  loadVault: () => Promise<void>;
  refreshTree: () => Promise<void>;
  openFile: (relPath: string) => Promise<void>;
  updateContent: (text: string) => void;
  markSaved: () => void;
  toggleFolder: (relPath: string) => void;
  setSelected: (relPath: string | null) => void;
  loadSync: () => Promise<void>;
  subscribeSync: () => () => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncPush: () => Promise<void>;
}

const EMPTY_SYNC: SyncStatus = {
  signedIn: false,
  email: null,
  vaultId: null,
  lastSyncedAt: null,
  syncing: false,
  message: null,
};

export const useStore = create<ShipiState>((set, get) => ({
  vault: null,
  tree: [],
  selectedPath: null,
  content: '',
  dirty: false,
  expanded: {},
  sync: EMPTY_SYNC,
  ready: false,

  loadVault: async () => {
    ensureVault();
    const tree = buildTree();
    set({
      vault: { rootPath: getVaultRootPath(), name: getVaultName() },
      tree,
      ready: true,
    });
  },

  refreshTree: async () => {
    const tree = buildTree();
    set({ tree });
  },

  openFile: async (relPath) => {
    const state = get();
    if (state.dirty && state.selectedPath) {
      await writeFile(state.selectedPath, state.content);
    }
    const content = await readFile(relPath);
    set({ selectedPath: relPath, content, dirty: false });
  },

  updateContent: (text) => set({ content: text, dirty: true }),

  markSaved: () => set({ dirty: false }),

  toggleFolder: (relPath) =>
    set((s) => ({ expanded: { ...s.expanded, [relPath]: !s.expanded[relPath] } })),

  setSelected: (selectedPath) => set({ selectedPath }),

  loadSync: async () => {
    const sync = await syncLib.initSync();
    set({ sync });
  },

  subscribeSync: () =>
    syncLib.onSyncStateChange((sync) => {
      set({ sync });
      if (!sync.syncing && sync.lastSyncedAt) {
        void get().refreshTree();
      }
    }),

  signUp: async (email, password) => {
    const sync = await syncLib.syncSignUp(email, password);
    set({ sync });
  },

  signIn: async (email, password) => {
    const sync = await syncLib.syncSignIn(email, password);
    set({ sync });
  },

  signOut: async () => {
    const sync = await syncLib.syncSignOut();
    set({ sync });
  },

  syncNow: async () => {
    const sync = await syncLib.syncNow();
    set({ sync });
  },

  syncPush: async () => {
    const sync = await syncLib.syncPush();
    set({ sync });
  },
}));
