import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { useEffect } from 'react';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

const paths = createVaultPaths('');

/** A vault made or opened on a page of the start flow takes that page's place in the history. */
export function useOpenWhenStarted(app: VaultApp, started: boolean): void {
  const router = useRouter();
  const { session } = app;
  useEffect(() => {
    if (started && !isNil(session)) {
      router.replace(paths.vault(session.vaultKey));
    }
  }, [started, session, router]);
}

/** Making or fetching another vault leaves the open one: it locks, as leaving its pages does. */
export function useLeaveOpenVault(app: VaultApp): void {
  useEffect(() => {
    if (!isNil(app.session)) {
      app.lock('left');
    }
  }, [app]);
}
