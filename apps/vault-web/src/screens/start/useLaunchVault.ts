import { isNil } from 'lodash-es';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { launchVaultOf } from '@frozik/vault-app/device/domain/launch-vault';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { paths } from '../paths';

/** A page opened at the start goes on to the vault opened last, once; the list stays one link away. */
export function useLaunchVault(app: VaultApp, takeLaunch: () => boolean): void {
  const navigate = useNavigate();
  const known = app.registry.vaults.value;
  useEffect(() => {
    if (isNil(known) || !takeLaunch()) {
      return;
    }
    const vaultKey = launchVaultOf(known, null);
    if (!isNil(vaultKey)) {
      void navigate(paths.vault(vaultKey));
    }
  }, [known, takeLaunch, navigate]);
}
