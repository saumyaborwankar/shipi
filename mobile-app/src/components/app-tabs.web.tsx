import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ShipiText } from './shipi/ui';
import { colors, radius, spacing } from '@/theme/tokens';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="vault" href="/" asChild>
            <TabButton>Vault</TabButton>
          </TabTrigger>
          <TabTrigger name="editor" href="/editor" asChild>
            <TabButton>Editor</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          isFocused ? { backgroundColor: colors.primarySoft } : null,
        ]}>
        <ShipiText type="bodySm" color={isFocused ? 'primaryActive' : 'inkMuted'} style={{ fontWeight: isFocused ? '700' : '600' }}>
          {children}
        </ShipiText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <ShipiText type="bodySm" color="ink" style={{ fontWeight: '700', marginRight: 'auto' }}>
          Shipi
        </ShipiText>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.xs,
    maxWidth: 720,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
});
