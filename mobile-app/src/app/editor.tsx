import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { MarkdownEditor } from '@/components/shipi/MarkdownEditor';
import { MarkdownPreview } from '@/components/shipi/MarkdownPreview';
import { SegmentedControl, ShipiText } from '@/components/shipi/ui';
import { EditIcon, EyeIcon, MarkdownIcon } from '@/components/shipi/Icons';
import { syncPush } from '@/lib/sync';
import { writeFile } from '@/lib/vault';
import { useStore } from '@/store';
import { colors, spacing } from '@/theme/tokens';

const SAVE_DEBOUNCE_MS = 600;
const FOOTER_HEIGHT = 36;

type EditorMode = 'source' | 'preview';
const MODES = ['source', 'preview'] as const;

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export default function EditorScreen(): React.ReactElement {
  const selectedPath = useStore((s) => s.selectedPath);
  const content = useStore((s) => s.content);
  const dirty = useStore((s) => s.dirty);
  const updateContent = useStore((s) => s.updateContent);
  const markSaved = useStore((s) => s.markSaved);
  const [mode, setMode] = useState<EditorMode>('source');

  const selectedName = selectedPath ? selectedPath.split('/').pop() : null;
  const words = useMemo(() => wordCount(content), [content]);

  const keyboardProgress = useSharedValue(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      keyboardProgress.value = withTiming(1, { duration: e.duration ?? 220 });
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      keyboardProgress.value = withTiming(0, { duration: e.duration ?? 220 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardProgress]);

  const footerAnim = useAnimatedStyle(() => ({
    opacity: 1 - keyboardProgress.value,
    transform: [{ translateY: interpolate(keyboardProgress.value, [0, 1], [0, FOOTER_HEIGHT]) }],
    maxHeight: interpolate(keyboardProgress.value, [0, 1], [FOOTER_HEIGHT, 0]),
  }));

  useEffect(() => {
    if (!selectedPath || !dirty) {
      return;
    }
    const timer = setTimeout(() => {
      void writeFile(selectedPath, content).then(() => {
        markSaved();
        void syncPush();
      });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, dirty, selectedPath, markSaved]);

  if (!selectedPath) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MarkdownIcon color={colors.primary} size={30} />
          </View>
          <ShipiText type="heading3" color="ink" style={styles.emptyTitle}>
            Nothing open yet
          </ShipiText>
          <ShipiText type="bodySm" color="inkMuted" style={styles.emptyBody}>
            Pick a note from the Vault tab, or create a new one. Your writing autosaves and
            stays encrypted on your device.
          </ShipiText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {dirty && <View style={styles.dirty} />}
            <ShipiText type="bodySm" color="ink" style={{ fontWeight: '600' }} numberOfLines={1}>
              {selectedName}
            </ShipiText>
            <View style={styles.modeBadge}>
              <ShipiText type="caption" color="inkFaint" style={{ fontSize: 11, fontWeight: '600' }}>
                {mode === 'source' ? 'EDITING' : 'PREVIEW'}
              </ShipiText>
            </View>
          </View>
          <SegmentedControl<EditorMode>
            options={MODES}
            value={mode}
            onChange={setMode}
            labels={{ source: 'Edit', preview: 'Preview' }}
          />
        </View>

        <View style={styles.body}>
          {mode === 'source' ? (
            <MarkdownEditor value={content} onChangeText={updateContent} />
          ) : (
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              contentContainerStyle={styles.previewContent}>
              <MarkdownPreview source={content} />
            </ScrollView>
          )}
        </View>

        <Animated.View style={[styles.footer, footerAnim]}>
          <View style={styles.footerLeft}>
            {mode === 'source' ? (
              <EditIcon color={colors.inkFaint} size={13} />
            ) : (
              <EyeIcon color={colors.inkFaint} size={13} />
            )}
            <ShipiText type="caption" color="inkFaint" style={{ fontSize: 12 }}>
              {words} {words === 1 ? 'word' : 'words'}
            </ShipiText>
          </View>
          <ShipiText type="caption" color={dirty ? 'warning' : 'inkFaint'} style={{ fontSize: 12, fontWeight: '500' }}>
            {dirty ? 'Saving…' : 'Saved'}
          </ShipiText>
        </Animated.View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  dirty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  modeBadge: {
    paddingHorizontal: spacing.xs - 2,
    paddingVertical: 2,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginLeft: 'auto',
  },
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  previewContent: {
    paddingBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: FOOTER_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 300,
  },
});
