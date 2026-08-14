import React, { useEffect, useRef, useState } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputKeyPressEventData } from 'react-native';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

interface InlineInputProps {
  initial: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function InlineInput({ initial, placeholder, onCommit, onCancel }: InlineInputProps): React.ReactElement {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<TextInput>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current as unknown as { focus: () => void } | null;
    input?.focus();
  }, []);

  const commit = (): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    const trimmed = value.trim();
    if (trimmed) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  };

  const cancel = (): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCancel();
  };

  return (
    <TextInput
      ref={inputRef}
      style={styles.input}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      onChangeText={setValue}
      onSubmitEditing={commit}
      onBlur={commit}
      onKeyPress={(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        if (e.nativeEvent.key === 'Escape') {
          cancel();
        }
      }}
      returnKeyType="done"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.xs,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans,
  },
});
