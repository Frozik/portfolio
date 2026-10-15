import { NONCE_BYTES, openBlock, sealBlock } from '@frozik/vault/crypto/aead';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { utf8 } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';

import type { ICustodyKey, ISessionKeyCustody } from '../domain/ports/key-custody';

const CHECK_BYTES = 32;

interface IQuickHold {
  readonly vaultKey: TVaultKey;
  readonly key: ICustodyKey;
  readonly nonce: TBytes;
  readonly sealedCheck: TBytes;
}

/**
 * A custody for a process that is the session (a page): nothing is kept
 * across a restart, so there is never a key to restore. A quick lock keeps
 * the non-extractable key in memory behind a check only the quick key opens;
 * a wrong one drops both, so there is one try.
 */
export function createMemoryKeyCustody(random: IRandom): ISessionKeyCustody {
  let quick: IQuickHold | null = null;
  const additionalData = (vaultKey: TVaultKey): TBytes => utf8(`pwv/quick/${vaultKey}`);
  return {
    hold: () => Promise.resolve(),
    restore: () => Promise.resolve(null),
    release: () => {
      quick = null;
      return Promise.resolve();
    },
    async lockQuick(vaultKey, key, quickKey) {
      const nonce = random.bytes(NONCE_BYTES);
      const sealedCheck = await sealBlock(
        quickKey,
        nonce,
        random.bytes(CHECK_BYTES),
        additionalData(vaultKey)
      );
      quick = { vaultKey, key, nonce, sealedCheck };
    },
    async unlockQuick(vaultKey, quickKey) {
      const held = quick;
      quick = null;
      if (isNil(held) || held.vaultKey !== vaultKey) {
        return null;
      }
      const opened = await openBlock(
        quickKey,
        held.nonce,
        held.sealedCheck,
        additionalData(vaultKey)
      );
      return opened.ok ? held.key : null;
    },
  };
}
