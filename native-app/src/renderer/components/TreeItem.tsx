import { useState } from 'react';
import { FileNode } from '../../shared/ipc';
import { useStore } from '../state/store';
import { ChevronIcon, FileIcon, FolderIcon, PencilIcon, PlusIcon, TrashIcon } from './Icons';
import { InlineInput } from './InlineInput';

interface TreeItemProps {
  node: FileNode;
  depth: number;
}

export function TreeItem({ node, depth }: TreeItemProps): React.ReactElement {
  const expanded = useStore((s) => s.expanded[node.relPath]);
  const selectedPath = useStore((s) => s.selectedPath);
  const toggleFolder = useStore((s) => s.toggleFolder);
  const openFile = useStore((s) => s.openFile);
  const setSelected = useStore((s) => s.setSelected);
  const [creating, setCreating] = useState<null | 'file' | 'folder'>(null);
  const [renaming, setRenaming] = useState(false);

  const isFolder = node.type === 'folder';

  const handleCreate = async (type: 'file' | 'folder', name: string): Promise<void> => {
    const newPath =
      type === 'file'
        ? await window.shipi.createFile(node.relPath, name)
        : await window.shipi.createFolder(node.relPath, name);
    useStore.setState((s) => ({ expanded: { ...s.expanded, [node.relPath]: true } }));
    await useStore.getState().refreshTree();
    if (type === 'file') {
      await useStore.getState().openFile(newPath);
    }
    setCreating(null);
  };

  const handleRename = async (name: string): Promise<void> => {
    const newPath = await window.shipi.rename(node.relPath, name);
    if (selectedPath === node.relPath) {
      useStore.setState({ selectedPath: newPath });
    }
    await useStore.getState().refreshTree();
    setRenaming(false);
  };

  const handleDelete = async (): Promise<void> => {
    const ok = window.confirm(`Delete "${node.name}"?`);
    if (!ok) {
      return;
    }
    await window.shipi.deleteEntry(node.relPath);
    if (selectedPath === node.relPath) {
      setSelected(null);
    }
    await useStore.getState().refreshTree();
  };

  const rowPadding = { paddingLeft: depth * 14 + 8 };

  return (
    <div className="tree-item">
      {renaming ? (
        <div className="tree-row" style={rowPadding}>
          <InlineInput
            initial={node.name}
            onCommit={(name) => void handleRename(name)}
            onCancel={() => setRenaming(false)}
          />
        </div>
      ) : (
        <div
          className={`tree-row${!isFolder && selectedPath === node.relPath ? ' tree-row--active' : ''}`}
          style={rowPadding}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.relPath);
            } else {
              void openFile(node.relPath);
            }
          }}
        >
          <span className="tree-row__caret">
            {isFolder && <ChevronIcon open={Boolean(expanded)} />}
          </span>
          <span className="tree-row__icon">
            {isFolder ? <FolderIcon open={Boolean(expanded)} /> : <FileIcon />}
          </span>
          <span className="tree-row__name" title={node.name}>
            {node.name}
          </span>
          <span className="tree-row__actions">
            {isFolder && (
              <button
                className="icon-btn"
                title="New note in folder"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreating('file');
                }}
              >
                <PlusIcon />
              </button>
            )}
            <button
              className="icon-btn"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
            >
              <PencilIcon />
            </button>
            <button
              className="icon-btn icon-btn--danger"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete();
              }}
            >
              <TrashIcon />
            </button>
          </span>
        </div>
      )}
      {creating && (
        <div className="tree-item__create" style={{ paddingLeft: depth * 14 + 22 }}>
          <InlineInput
            initial=""
            placeholder={creating === 'file' ? 'note name' : 'folder name'}
            onCommit={(name) => void handleCreate(creating, name)}
            onCancel={() => setCreating(null)}
          />
        </div>
      )}
      {isFolder && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.relPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
