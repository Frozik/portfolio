import { isNil } from 'lodash-es';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { paths } from '../paths';

/** A vault made or opened on a page of the start flow takes that page's place in the history. */
export function useOpenWhenStarted(app: VaultApp, started: boolean): void {
  const navigate = useNavigate();
  const { session } = app;
  useEffect(() => {
    if (started && !isNil(session)) {
      void navigate(paths.vault(session.vaultKey), { replace: true });
    }
  }, [started, session, navigate]);
}
