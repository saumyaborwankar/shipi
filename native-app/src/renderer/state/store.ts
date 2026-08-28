import { create } from 'zustand';
import { FileNode, VaultInfo } from '../../shared/ipc';
import { SyncStatus } from '../../shared/sync';

interface ShipiState {
  vault: VaultInfo | null;
  tree: FileNode[];
  selectedPath: string | null;
  content: string;
  dirty: boolean;
  expanded: Record<string, boolean>;
  sync: SyncStatus;
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
  signInWithGoogle: () => Promise<void>;
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

  loadVault: async () => {
    const vault = await window.shipi.vaultInfo();
    const tree = await window.shipi.vaultTree();
    set({ vault, tree });
  },

  refreshTree: async () => {
    const tree = await window.shipi.vaultTree();
    set({ tree });
  },

  openFile: async (relPath) => {
    const state = get();
    if (state.dirty && state.selectedPath) {
      await window.shipi.writeFile(state.selectedPath, state.content);
    }
    const content = await window.shipi.readFile(relPath);
    set({ selectedPath: relPath, content, dirty: false });
  },

  updateContent: (text) => set({ content: text, dirty: true }),

  markSaved: () => set({ dirty: false }),

  toggleFolder: (relPath) =>
    set((s) => ({ expanded: { ...s.expanded, [relPath]: !s.expanded[relPath] } })),

  setSelected: (selectedPath) => set({ selectedPath }),

  loadSync: async () => {
    const sync = await window.shipi.syncStatus();
    set({ sync });
  },

  subscribeSync: () =>
    window.shipi.onSyncStateChange((sync) => {
      set({ sync });
      if (!sync.syncing && sync.lastSyncedAt) {
        void get().refreshTree();
      }
    }),

  signUp: async (email, password) => {
    const sync = await window.shipi.syncSignUp(email, password);
    set({ sync });
  },

  signIn: async (email, password) => {
    const sync = await window.shipi.syncSignIn(email, password);
    set({ sync });
  },

  signInWithGoogle: async () => {
    const sync = await window.shipi.syncSignInWithGoogle();
    set({ sync });
  },

  signOut: async () => {
    const sync = await window.shipi.syncSignOut();
    set({ sync });
  },

  syncNow: async () => {
    const sync = await window.shipi.syncNow();
    set({ sync });
  },

  syncPush: async () => {
    const sync = await window.shipi.syncPush();
    set({ sync });
  },
}));
