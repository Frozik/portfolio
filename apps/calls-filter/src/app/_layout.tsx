import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startApp, stopApp } from '../composition-root';
import { Boot } from '../ui/Boot';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Boot start={startApp} stop={stopApp}>
        <Stack screenOptions={{ headerShown: false }} />
      </Boot>
    </SafeAreaProvider>
  );
}
