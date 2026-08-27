import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FileNode } from '@/lib/types';
import { createFile, createFolder, deleteEntry, renameEntry } from '@/lib/vault';
import { useStore } from '@/store';
import { ChevronIcon, FileIcon, FolderIcon, PencilIcon, PlusIcon, TrashIcon } from './Icons';
import { InlineInput } from './InlineInput';
import { IconButton } from './ui';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

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
  const isOpen = Boolean(expanded);
  const isActive = !isFolder && selectedPath === node.relPath;

  const handleCreate = async (type: 'file' | 'folder', name: string): Promise<void> => {
    const newPath =
      type === 'file'
        ? createFile(node.relPath, name)
        : createFolder(node.relPath, name);
    useStore.setState((s) => ({ expanded: { ...s.expanded, [node.relPath]: true } }));
    await useStore.getState().refreshTree();
    if (type === 'file') {
      await useStore.getState().openFile(newPath);
    }
    setCreating(null);
  };

  const handleRename = async (name: string): Promise<void> => {
    const newPath = renameEntry(node.relPath, name);
    if (selectedPath === node.relPath) {
      useStore.setState({ selectedPath: newPath });
    }
    await useStore.getState().refreshTree();
    setRenaming(false);
  };

  const handleDelete = async (): Promise<void> => {
    Alert.alert(`Delete "${node.name}"?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEntry(node.relPath);
          if (selectedPath === node.relPath) {
            setSelected(null);
          }
          void useStore.getState().refreshTree();
        },
      },
    ]);
  };

  const rowPadding = { paddingLeft: depth * 16 + 10 };

  return (
    <View>
      {renaming ? (
        <View style={[styles.row, rowPadding, styles.renaming]}>
          <InlineInput
            initial={node.name}
            onCommit={(name) => void handleRename(name)}
            onCancel={() => setRenaming(false)}
          />
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            rowPadding,
            isActive && styles.rowActive,
            pressed && !isActive && styles.rowPressed,
          ]}
          onPress={() => {
            if (isFolder) {
              toggleFolder(node.relPath);
            } else {
              void openFile(node.relPath);
            }
          }}>
          {isActive && <View style={styles.activeBar} />}
          <View style={styles.caret}>
            {isFolder ? (
              <ChevronIcon color={isOpen ? colors.primary : colors.inkFaint} open={isOpen} />
            ) : (
              <View style={styles.fileDot} />
            )}
          </View>
          <View style={styles.icon}>
            {isFolder ? (
              <FolderIcon color={isOpen ? colors.primary : colors.inkMuted} open={isOpen} />
            ) : (
              <FileIcon color={isActive ? colors.primary : colors.inkFaint} />
            )}
          </View>
          <View style={styles.nameWrap}>
            <Text
              style={[styles.nameText, isFolder && styles.folderName, isActive && styles.activeName]}
              numberOfLines={1}>
              {node.name}
            </Text>
          </View>
          <View style={styles.actions}>
            {isFolder && (
              <IconButton accessibilityLabel="New note in folder" onPress={() => setCreating('file')} style={styles.actionBtn}>
                <PlusIcon color={colors.inkMuted} size={16} />
              </IconButton>
            )}
            <IconButton accessibilityLabel="Rename" onPress={() => setRenaming(true)} style={styles.actionBtn}>
              <PencilIcon color={colors.inkMuted} size={16} />
            </IconButton>
            <IconButton accessibilityLabel="Delete" danger onPress={() => void handleDelete()} style={styles.actionBtn}>
              <TrashIcon color={colors.inkMuted} size={16} />
            </IconButton>
          </View>
        </Pressable>
      )}
      {creating && (
        <View style={[styles.create, { paddingLeft: depth * 16 + 30 }]}>
          <InlineInput
            initial=""
            placeholder={creating === 'file' ? 'note name' : 'folder name'}
            onCommit={(name) => void handleCreate(creating, name)}
            onCancel={() => setCreating(null)}
          />
        </View>
      )}
      {isFolder && isOpen && node.children && (
        <View>
          {node.children.map((child) => (
            <TreeItem key={child.relPath} node={child} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs - 2,
    paddingVertical: 9,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    marginHorizontal: spacing.xxs,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.primary,
  },
  rowActive: {
    backgroundColor: colors.selection,
  },
  rowPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  renaming: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.xxs,
  },
  caret: {
    width: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkFaint,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    fontSize: 14.5,
    color: colors.inkSecondary,
    fontFamily: fonts.sans,
    fontWeight: '500',
  },
  folderName: {
    color: colors.ink,
  },
  activeName: {
    color: colors.primaryActive,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs - 2,
  },
  actionBtn: {
    padding: spacing.xxs - 1,
  },
  create: {
    paddingVertical: 2,
    paddingRight: spacing.xs,
  },
});
