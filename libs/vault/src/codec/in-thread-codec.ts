import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';

import { calibrateArgon2 } from '../crypto/kdf-calibration';
import type { IKdf } from '../crypto/kdf-port';
import { decodeDocument, encodeDocument } from '../format/document-codec';
import {
  withNewKey,
  withNewPassword,
  withPasskey,
  withRecoveryKey,
} from '../format/keyslot-changes';
import { openVaultFile } from '../format/open-vault';
import { sealVaultFile } from '../format/seal-vault';
import { createVaultKeys } from '../format/vault-keys';
import type { IRandom } from '../ports/random';
import type { IVaultCodec } from './vault-codec';

/**
 * The codec on the calling thread: the extension's service worker, which
 * cannot start a Worker, and tests. Argon2 cannot be interrupted, so an
 * abort is honoured before and after the work, not in the middle of it.
 */
export function createInThreadCodec({
  argon2,
  random,
  elapsed,
}: {
  readonly argon2: IKdf;
  readonly random: IRandom;
  /** A monotonic clock for calibration, `performance.now` in a browser. */
  readonly elapsed: () => Milliseconds;
}): IVaultCodec {
  return {
    async createKeys(password, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const params = await calibrateArgon2(argon2, elapsed);
      const keys = await createVaultKeys(password, params, { argon2, random });
      return signal.aborted ? err({ kind: 'aborted' }) : ok(keys);
    },
    async changePassword(keys, { current, next }, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const params = await calibrateArgon2(argon2, elapsed);
      const changed = await withNewPassword(keys, { current, next, params }, { argon2, random });
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      return changed.ok ? changed : err({ kind: changed.error });
    },
    async rotateKey(keys, password, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const params = await calibrateArgon2(argon2, elapsed);
      const rotated = await withNewKey(keys, { password, params }, { argon2, random });
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      return rotated.ok ? rotated : err({ kind: rotated.error });
    },
    async addPasskey(keys, change, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const changed = await withPasskey(keys, change, { argon2, random });
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      return changed.ok ? changed : err({ kind: changed.error });
    },
    async addRecoveryKey(keys, change, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const changed = await withRecoveryKey(keys, change, { argon2, random });
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      return changed.ok ? changed : err({ kind: changed.error });
    },
    async open(file, unlock, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      const opened = await openVaultFile(file, unlock, argon2);
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      if (!opened.ok) {
        return opened;
      }
      const document = decodeDocument(opened.value.entries);
      if (!document.ok) {
        return err({ kind: document.error });
      }
      const { header, keys, manifest, access } = opened.value;
      return ok({ header, keys, manifest, access, document: document.value });
    },
    async seal(document, manifest, context, signal) {
      if (signal.aborted) {
        return err({ kind: 'aborted' });
      }
      return ok(
        await sealVaultFile({ manifest, entries: encodeDocument(document) }, context, random)
      );
    },
  };
}
