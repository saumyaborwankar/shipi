import { create } from 'zustand';
import { FileNode, VaultInfo } from '../../shared/ipc';

interface ShipiState {
  vault: VaultInfo | null;
  tree: FileNode[];
  selectedPath: string | null;
  content: string;
  dirty: boolean;
  expanded: Record<string, boolean>;
  loadVault: () => Promise<void>;
  refreshTree: () => Promise<void>;
  openFile: (relPath: string) => Promise<void>;
  updateContent: (text: string) => void;
  markSaved: () => void;
  toggleFolder: (relPath: string) => void;
  setSelected: (relPath: string | null) => void;
}

export const useStore = create<ShipiState>((set, get) => ({
  vault: null,
  tree: [],
  selectedPath: null,
  content: '',
  dirty: false,
  expanded: {},

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
}));
