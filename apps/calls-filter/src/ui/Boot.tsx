import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import type { CallsFilterApp } from '../contexts/shell/application/CallsFilterApp';

import { AppTexts } from '../texts/use-texts';
import { AppProvider } from './AppContext';
import { ChangeSnackbar } from './ChangeSnackbar';
import { PendingConflictSheet } from './conflicts/PendingConflictSheet';
import { HoldHintLayer } from './kit/HoldHint';
import { PermissionSheet } from './PermissionSheet';
import type { TScheme } from './theme/AppTheme';
import { AppTheme } from './theme/AppTheme';

const Themed = observer(function Themed({
  app,
  children,
}: {
  readonly app: CallsFilterApp;
  readonly children: ReactNode;
}) {
  const system = useColorScheme();
  const { theme } = app.device.preferences;
  const scheme: TScheme = theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : theme;
  return (
    <AppTheme scheme={scheme}>
      <AppTexts language={app.device.language}>
        <HoldHintLayer>
          {children}
          <ChangeSnackbar />
          <PendingConflictSheet />
          <PermissionSheet />
        </HoldHintLayer>
      </AppTexts>
    </AppTheme>
  );
});

/** Starts the app once, refreshes it whenever it comes to the front, and renders the screens inside it. */
export function Boot({
  start,
  stop,
  children,
}: {
  readonly start: () => Promise<CallsFilterApp>;
  readonly stop: (app: CallsFilterApp) => void;
  readonly children: ReactNode;
}) {
  const [app, setApp] = useState<CallsFilterApp | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let started: CallsFilterApp | null = null;
    start().then(
      created => {
        started = created;
        setApp(created);
      },
      (error: unknown) => {
        setFailure(String(error));
      }
    );
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void started?.foreground();
      }
    });
    return () => {
      subscription.remove();
      if (started !== null) {
        stop(started);
      }
    };
  }, [start, stop]);
  if (app === null) {
    return (
      <View testID={failure === null ? 'boot-loading' : 'boot-failed'} style={styles.center}>
        {failure === null ? <ActivityIndicator /> : <Text style={styles.failure}>{failure}</Text>}
      </View>
    );
  }
  return (
    <AppProvider app={app}>
      <Themed app={app}>{children}</Themed>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  failure: { fontFamily: 'monospace', fontSize: 13, color: NATIVE_PALETTES.light.danger },
});
