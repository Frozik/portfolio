import type { Language } from '@frozik/utils/i18n/language';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { TFollowIncomingFiles } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';
import { DiagnosticsModel } from '@frozik/vault-app/diagnostics/application/DiagnosticsModel';
import { PendingImport } from '@frozik/vault-app/interchange/application/PendingImport';
import type { TSaveFile } from '@frozik/vault-app/interchange/domain/ports/file-saver';
import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { createFakeSessionClock } from '@frozik/vault-app/testing/fake-session-clock';
import { createMemoryDiagnosticsJournal } from '@frozik/vault-app/testing/memory-diagnostics-journal';

import { AppModel } from '../app-model';
import { AppLanguage } from '../texts';
import { AppTheme } from '../theme/AppTheme';

const PHONE_FRAME = { x: 0, y: 0, width: 412, height: 915 };
const NO_INSETS = { top: 0, left: 0, right: 0, bottom: 0 };
export const TEST_VERSION = 'v1.4.0';

/** A release watch that has heard of no release: no notice, no lock. */
function quietUpdates(): UpdateWatch {
  return new UpdateWatch(
    { read: () => Promise.resolve(null) },
    { client: 'android', version: TEST_VERSION }
  );
}

const NO_INCOMING_FILES: TFollowIncomingFiles = () => () => undefined;

const SAVED: TSaveFile = () => Promise.resolve('saved');
const SAVING_NOWHERE = { saveToFolder: SAVED, share: SAVED };

function emptyDiagnostics(): DiagnosticsModel {
  return new DiagnosticsModel(createMemoryDiagnosticsJournal(), createFakeSessionClock().clock);
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
  followIncomingFiles = NO_INCOMING_FILES,
  pendingImport = new PendingImport(),
  fileSavers = SAVING_NOWHERE,
  diagnostics = emptyDiagnostics(),
  language = 'en',
  launch = null,
  children,
}: {
  readonly app: VaultApp;
  readonly updates?: UpdateWatch;
  /** Files other apps hand over; none by default. */
  readonly followIncomingFiles?: TFollowIncomingFiles;
  readonly pendingImport?: PendingImport;
  /** Where a card's file goes; saved nowhere by default. */
  readonly fileSavers?: { readonly saveToFolder: TSaveFile; readonly share: TSaveFile };
  /** The device's diagnostics; an empty log by default. */
  readonly diagnostics?: DiagnosticsModel;
  readonly language?: Language;
  /** A launch to act on; none by default, so a test's start screen stays on the list. */
  readonly launch?: { readonly locked: string | null } | null;
  readonly children: ReactNode;
}) {
  return (
    <AppLanguage language={language}>
      <AppModel
        model={{
          app,
          updates,
          diagnostics,
          followIncomingFiles,
          pendingImport,
          fileSavers,
          version: TEST_VERSION,
          takeLaunch: oneShot(launch),
        }}
      >
        <AppTheme appearance={app.appearance}>
          <SafeAreaProvider initialMetrics={{ frame: PHONE_FRAME, insets: NO_INSETS }}>
            {children}
          </SafeAreaProvider>
        </AppTheme>
      </AppModel>
    </AppLanguage>
  );
}
