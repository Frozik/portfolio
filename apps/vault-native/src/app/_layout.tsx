import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { followUpdates } from '../app-updates';
import { createUpdateWatch, createVaultApp } from '../composition-root';
import { createNativeLockSignals } from '../infrastructure/app-state-lock-signals';
import { phoneLanguage } from '../infrastructure/locale';
import { takeLaunchOnStart } from '../infrastructure/runtime-reload-wipe';
import { clearLeftoverExports } from '../infrastructure/share-sheet-file-saver';
import { AppModel } from '../ui/app-model';
import { PrivacyCurtain } from '../ui/PrivacyCurtain';
import { ScreenCaptureGuard } from '../ui/ScreenCaptureGuard';
import { AppLanguage } from '../ui/texts';
import { AppTheme } from '../ui/theme/AppTheme';
import { ThemedStack } from '../ui/theme/ThemedStack';
import { UpdateGate } from '../ui/UpdateGate';

const APP_VERSION = `v${Constants.expoConfig?.version ?? '0.0.0'}`;

/**
 * The composition root: the phone's adapters are made here, the screens below
 * get models. The app lives as long as the JavaScript runtime, and a lock
 * ends both with a reload, so nothing here is torn down.
 */
export default function RootLayout() {
  const [language] = useState(phoneLanguage);
  const [lock] = useState(createNativeLockSignals);
  const [model] = useState(() => ({
    app: createVaultApp(language, lock),
    updates: createUpdateWatch(APP_VERSION),
    version: APP_VERSION,
    takeLaunch: takeLaunchOnStart(),
  }));
  useEffect(() => {
    void model.app.registry.refresh();
  }, [model]);
  useEffect(clearLeftoverExports, []);
  useEffect(() => followUpdates(model.app, model.updates, lock.signals), [model, lock]);
  return (
    <AppLanguage language={language}>
      <AppModel model={model}>
        <AppTheme appearance={model.app.appearance}>
          <SafeAreaProvider>
            <View style={styles.root} onTouchStart={lock.reportActivity}>
              <UpdateGate updates={model.updates}>
                <ThemedStack />
              </UpdateGate>
            </View>
            <PrivacyCurtain />
            <ScreenCaptureGuard app={model.app} />
          </SafeAreaProvider>
        </AppTheme>
      </AppModel>
    </AppLanguage>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
