import { useState } from 'react';
import { useStore } from '../state/store';
import { InlineInput } from './InlineInput';
import { TreeItem } from './TreeItem';
import { SyncPanel } from './SyncPanel';

export function Sidebar(): React.ReactElement {
  const tree = useStore((s) => s.tree);
  const [creating, setCreating] = useState<null | 'file' | 'folder'>(null);

  const handleCreate = async (type: 'file' | 'folder', name: string): Promise<void> => {
    const newPath =
      type === 'file'
        ? await window.shipi.createFile(null, name)
        : await window.shipi.createFolder(null, name);
    await useStore.getState().refreshTree();
    if (type === 'file') {
      await useStore.getState().openFile(newPath);
    }
    setCreating(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <button className="btn" onClick={() => setCreating('file')}>
          New note
        </button>
        <button className="btn" onClick={() => setCreating('folder')}>
          New folder
        </button>
      </div>
      <div className="sidebar__tree">
        {creating && (
          <div className="tree-item__create">
            <InlineInput
              initial=""
              placeholder={creating === 'file' ? 'note name' : 'folder name'}
              onCommit={(name) => void handleCreate(creating, name)}
              onCancel={() => setCreating(null)}
            />
          </div>
        )}
        {tree.map((node) => (
          <TreeItem key={node.relPath} node={node} depth={0} />
        ))}
        {tree.length === 0 && <div className="sidebar__empty">Vault is empty</div>}
      </div>
      <SyncPanel />
    </aside>
  );
}
