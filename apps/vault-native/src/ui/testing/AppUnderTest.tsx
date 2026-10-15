import type { Language } from '@frozik/utils/i18n/language';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

import { AppModel } from '../app-model';
import { AppLanguage } from '../texts';
import { AppTheme } from '../theme/AppTheme';

const PHONE_FRAME = { x: 0, y: 0, width: 412, height: 915 };
const NO_INSETS = { top: 0, left: 0, right: 0, bottom: 0 };
const TEST_VERSION = 'v1.4.0';

/** A release watch that has heard of no release: no notice, no lock. */
function quietUpdates(): UpdateWatch {
  return new UpdateWatch(
    { read: () => Promise.resolve(null) },
    { client: 'android', version: TEST_VERSION }
  );
}

function oneShot<T>(value: T | null): () => T | null {
  let left = value;
  return () => {
    const taken = left;
    left = null;
    return taken;
  };
}

/** What the root layout gives every screen, with the test's app and language. */
export function AppUnderTest({
  app,
  updates = quietUpdates(),
  language = 'en',
  launch = null,
  children,
}: {
  readonly app: VaultApp;
  readonly updates?: UpdateWatch;
  readonly language?: Language;
  /** A launch to act on; none by default, so a test's start screen stays on the list. */
  readonly launch?: { readonly locked: string | null } | null;
  readonly children: ReactNode;
}) {
  return (
    <AppLanguage language={language}>
      <AppModel model={{ app, updates, version: TEST_VERSION, takeLaunch: oneShot(launch) }}>
        <AppTheme appearance={app.appearance}>
          <SafeAreaProvider initialMetrics={{ frame: PHONE_FRAME, insets: NO_INSETS }}>
            {children}
          </SafeAreaProvider>
        </AppTheme>
      </AppModel>
    </AppLanguage>
  );
}
