import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InlineInput } from '@/components/shipi/InlineInput';
import { SyncPanel } from '@/components/shipi/SyncPanel';
import { TreeItem } from '@/components/shipi/TreeItem';
import { Button, Card, EmptyState, ShipiText, Skeleton } from '@/components/shipi/ui';
import { FolderIcon, PlusIcon, VaultIcon } from '@/components/shipi/Icons';
import type { FileNode } from '@/lib/types';
import { createFile, createFolder } from '@/lib/vault';
import { useStore } from '@/store';
import { colors, radius, shadows, spacing } from '@/theme/tokens';

function countNodes(nodes: FileNode[], kind: 'file' | 'folder'): number {
  return nodes.reduce((acc, node) => {
    const self = node.type === kind ? 1 : 0;
    const children = node.type === 'folder' && node.children ? countNodes(node.children, kind) : 0;
    return acc + self + children;
  }, 0);
}

export default function VaultScreen(): React.ReactElement {
  const tree = useStore((s) => s.tree);
  const ready = useStore((s) => s.ready);
  const [creating, setCreating] = useState<null | 'file' | 'folder'>(null);

  const counts = useMemo(() => {
    const files = countNodes(tree, 'file');
    const folders = countNodes(tree, 'folder');
    const parts: string[] = [];
    if (files > 0) {
      parts.push(`${files} ${files === 1 ? 'note' : 'notes'}`);
    }
    if (folders > 0) {
      parts.push(`${folders} ${folders === 1 ? 'folder' : 'folders'}`);
    }
    return parts.join(' · ') || 'Empty vault';
  }, [tree]);

  const handleCreate = async (type: 'file' | 'folder', name: string): Promise<void> => {
    const newPath =
      type === 'file' ? createFile(null, name) : createFolder(null, name);
    await useStore.getState().refreshTree();
    if (type === 'file') {
      await useStore.getState().openFile(newPath);
    }
    setCreating(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <VaultIcon color={colors.onPrimary} size={20} />
            </View>
            <View style={styles.brandText}>
              <ShipiText type="title" color="ink" style={{ fontWeight: '700' }}>
                My Vault
              </ShipiText>
              <ShipiText type="caption" color="inkFaint">
                {counts}
              </ShipiText>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Button
              variant="primary"
              leading={<PlusIcon color={colors.onPrimary} size={18} />}
              style={styles.actionButton}
              onPress={() => setCreating('file')}>
              New note
            </Button>
            <Button
              leading={<FolderIcon open color={colors.inkMuted} size={18} />}
              style={styles.actionButton}
              onPress={() => setCreating('folder')}>
              New folder
            </Button>
          </View>
        </View>

        <ScrollView
          style={styles.tree}
          contentContainerStyle={styles.treeContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          {creating && (
            <View style={styles.createRoot}>
              <InlineInput
                initial=""
                placeholder={creating === 'file' ? 'Note name' : 'Folder name'}
                onCommit={(name) => void handleCreate(creating, name)}
                onCancel={() => setCreating(null)}
              />
            </View>
          )}

          {!ready ? (
            <View style={styles.skeletons}>
              <Skeleton height={18} width="38%" />
              <Skeleton height={18} width="62%" />
              <View style={styles.skeletonRow}>
                <Skeleton height={16} width={16} round={radius.sm} />
                <Skeleton height={16} width="52%" />
              </View>
              <View style={styles.skeletonRow}>
                <Skeleton height={16} width={16} round={radius.sm} />
                <Skeleton height={16} width="44%" />
              </View>
            </View>
          ) : (
            tree.map((node) => (
              <TreeItem key={node.relPath} node={node} depth={0} />
            ))
          )}

          {ready && tree.length === 0 && !creating && (
            <Card style={styles.emptyCard} padded={false}>
              <EmptyState
                icon={<VaultIcon color={colors.primary} size={28} />}
                title="Your vault is empty"
                body="Create your first note to start writing. Notes stay on your device and can be synced privately across your devices."
                actions={
                  <View style={styles.emptyActions}>
                    <Button variant="primary" onPress={() => setCreating('file')}>
                      New note
                    </Button>
                    <Button onPress={() => setCreating('folder')}>
                      New folder
                    </Button>
                  </View>
                }
              />
            </Card>
          )}
        </ScrollView>

        <SyncPanel />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  container: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  brandText: {
    flex: 1,
    gap: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  tree: {
    flex: 1,
  },
  treeContent: {
    paddingVertical: spacing.xxs,
    paddingBottom: spacing.sm,
  },
  createRoot: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  skeletons: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  emptyCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    ...shadows.soft,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
