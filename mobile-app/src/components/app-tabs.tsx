import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { colors } from '@/theme/tokens';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.canvas}
      tintColor={colors.primary}
      iconColor={{ default: colors.inkFaint, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.inkMuted },
        selected: { color: colors.primary, fontWeight: '600' },
      }}
      shadowColor={colors.hairline}
      minimizeBehavior="never">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Vault</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="folder" md="folder" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="editor">
        <NativeTabs.Trigger.Label>Editor</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text" md="description" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
