import React from 'react';
import { StyleSheet, TextInput, ViewStyle, StyleProp } from 'react-native';
import { colors, fonts, spacing } from '@/theme/tokens';

interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function MarkdownEditor({ value, onChangeText, style }: MarkdownEditorProps): React.ReactElement {
  return (
    <TextInput
      style={[styles.editor, style]}
      value={value}
      onChangeText={onChangeText}
      multiline
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      textAlignVertical="top"
      placeholder="Start writing…"
      placeholderTextColor={colors.inkFaint}
    />
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink,
    fontFamily: fonts.mono,
    backgroundColor: colors.surface,
  },
});
