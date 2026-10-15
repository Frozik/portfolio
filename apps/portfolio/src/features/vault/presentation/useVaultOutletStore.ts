import { useOutletContext } from 'react-router-dom';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

/** The child routes read the store the `Vault` shell built and passed down its outlet. */
export function useVaultOutletStore(): VaultApp {
  return useOutletContext<VaultApp>();
}
