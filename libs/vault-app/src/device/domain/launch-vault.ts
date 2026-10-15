import type { IKnownVault, TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil, maxBy } from 'lodash-es';

/**
 * The vault the app opens on at launch, people mostly keeping one: the one a lock just closed,
 * else the one opened last; none for a device that has never opened one.
 */
export function launchVaultOf(
  known: readonly IKnownVault[],
  locked: TVaultKey | null
): TVaultKey | null {
  if (!isNil(locked) && known.some(vault => vault.vaultKey === locked)) {
    return locked;
  }
  return (
    maxBy(
      known.filter(vault => !isNil(vault.lastOpenedAt)),
      vault => vault.lastOpenedAt
    )?.vaultKey ?? null
  );
}
