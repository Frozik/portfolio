import { isNil } from 'lodash-es';
import { useEffect } from 'react';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

/** Making or fetching another vault leaves the open one: it locks, as leaving its pages does. */
export function useLeaveOpenVault(app: VaultApp): void {
  useEffect(() => {
    if (!isNil(app.session)) {
      app.lock('left');
    }
  }, [app]);
}
