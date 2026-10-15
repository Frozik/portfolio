import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { IRandom } from '@frozik/vault/ports/random';

import { createMemoryKeyCustody } from '../session/application/memory-key-custody';
import type { ICustodyKey, ISessionKeyCustody } from '../session/domain/ports/key-custody';

/**
 * A custody that keeps the key across a process restart, as a sleeping
 * extension worker needs; its quick lock is the memory custody's.
 */
export function createFakeKeyCustody(random: IRandom) {
  let held: { readonly vaultKey: TVaultKey; readonly key: ICustodyKey } | null = null;
  const quick = createMemoryKeyCustody(random);
  const custody: ISessionKeyCustody = {
    hold: (vaultKey, key) => {
      held = { vaultKey, key };
      return Promise.resolve();
    },
    restore: vaultKey => Promise.resolve(held?.vaultKey === vaultKey ? held.key : null),
    release: () => {
      held = null;
      return quick.release();
    },
    lockQuick: quick.lockQuick,
    unlockQuick: quick.unlockQuick,
  };
  return { custody, held: () => held };
}
