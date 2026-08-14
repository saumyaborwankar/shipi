import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { useStore } from '@/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const ready = useStore((s) => s.ready);

  useEffect(() => {
    void useStore.getState().loadVault();
    void useStore.getState().loadSync();
    const unsubscribe = useStore.getState().subscribeSync();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  return (
    <View style={{ flex: 1 }}>
      <AppTabs />
    </View>
  );
}
