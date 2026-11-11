import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PendingImport } from '@frozik/vault-app/interchange/application/PendingImport';
import { followUpdates } from '../app-updates';
import {
  createDiagnostics,
  createDiagnosticsJournal,
  createUpdateWatch,
  createVaultApp,
  FILE_SAVERS,
  INCOMING_FILES,
} from '../composition-root';
import { createNativeLockSignals } from '../infrastructure/app-state-lock-signals';
import { phoneLanguage } from '../infrastructure/locale';
import { clearLeftoverQrScans } from '../infrastructure/ml-kit-qr-reader';
import { takeLaunchOnStart } from '../infrastructure/runtime-reload-wipe';
import { clearLeftoverExports } from '../infrastructure/share-sheet-file-saver';
import { AppModel } from '../ui/app-model';
import { PrivacyCurtain } from '../ui/PrivacyCurtain';
import { ScreenCaptureGuard } from '../ui/ScreenCaptureGuard';

import { IncomingFiles } from '../ui/start/IncomingFiles';
import { AppLanguage } from '../ui/texts';
import { AppTheme } from '../ui/theme/AppTheme';
import { ThemedStack } from '../ui/theme/ThemedStack';
import { UpdateGate } from '../ui/UpdateGate';

const release: unknown = Constants.expoConfig?.extra?.release;
const APP_VERSION = typeof release === 'string' ? `v${release.replace(/^v/, '')}` : 'dev';

/**
 * The composition root: the phone's adapters are made here, the screens below
 * get models. The app lives as long as the JavaScript runtime, and a lock
 * ends both with a reload, so nothing here is torn down.
 */
export default function RootLayout() {
  const [language] = useState(phoneLanguage);
  const [lock] = useState(createNativeLockSignals);
  const [model] = useState(() => {
    const journal = createDiagnosticsJournal();
    return {
      app: createVaultApp(language, lock, journal),
      diagnostics: createDiagnostics(journal),
      followIncomingFiles: INCOMING_FILES,
      pendingImport: new PendingImport(),
      fileSavers: FILE_SAVERS,
      updates: createUpdateWatch(APP_VERSION),
      version: APP_VERSION,
      takeLaunch: takeLaunchOnStart(),
    };
  });
  useEffect(() => {
    void model.app.registry.refresh();
  }, [model]);
  useEffect(() => {
    clearLeftoverExports();
    clearLeftoverQrScans();
  }, []);
  useEffect(() => followUpdates(model.app, model.updates, lock.signals), [model, lock]);
  return (
    <AppLanguage language={language}>
      <AppModel model={model}>
        <AppTheme appearance={model.app.appearance}>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root} onTouchStart={lock.reportActivity}>
              <UpdateGate updates={model.updates}>
                <ThemedStack />
                <IncomingFiles />
              </UpdateGate>
            </GestureHandlerRootView>
            <PrivacyCurtain />
            <ScreenCaptureGuard app={model.app} />
          </SafeAreaProvider>
        </AppTheme>
      </AppModel>
    </AppLanguage>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
