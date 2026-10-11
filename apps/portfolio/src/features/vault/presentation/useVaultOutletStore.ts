import { useOutletContext } from 'react-router-dom';

import type { VaultFeatureStore } from '../application/VaultFeatureStore';

/** The child routes read the store the `Vault` shell built and passed down its outlet. */
export function useVaultOutletStore(): VaultFeatureStore {
  return useOutletContext<VaultFeatureStore>();
}
