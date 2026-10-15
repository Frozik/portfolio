import type { IStorageProvider, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { IOpenedVault, IVaultCodec, TCodecError } from '../codec/vault-codec';
import type { TBytes } from '../crypto/bytes';
import { toHex } from '../crypto/bytes';
import { decodeHeader } from '../format/header';
import type { TManifest } from '../format/manifest';
import type { ISealContext } from '../format/seal-vault';
import type { IVaultKeys } from '../format/vault-keys';
import type { IVaultDocument } from '../model/vault-document';
import type { IRandom } from '../ports/random';
import { retryDelay } from '../sync/retry-delay';
import type { TSyncEffect } from '../sync/sync-effects';
import type { IOpenedHeader, TOpenFailure, TSyncEvent } from '../sync/sync-events';
import type { ISyncGuard } from '../sync/sync-state';
import { vaultKeyOf } from './vault-key-of';

/** One storage target of a session, seen from the engine's effects: the target itself, and the session's side of each effect. */
export interface ISyncReplica {
  readonly provider: IStorageProvider;
  readonly path: TStoragePath;
  readonly codec: IVaultCodec;
  readonly random: IRandom;
  readonly keys: IVaultKeys;
  readonly manifest: TManifest;
  /** The session's document as it is now; a merge or a seal always takes the latest. */
  document(): IVaultDocument;
  /** Merges the remote into the session's document; answers whether the result holds anything the remote lacks. */
  merge(remote: IVaultDocument): boolean;
  /**
   * The slot set of a file under the same key: the session
   * decides whether it is news (the password changed on another device).
   */
  adoptKeys(keys: IVaultKeys): void;
  /** The session's slot set of this epoch reached a target: it is the shared base from now on. */
  keysShared(keyslotsEpoch: number): void;
  saveGuard(guard: ISyncGuard, lastSyncedRev: string | null): Promise<void>;
  /** Resolves `false` when the signal aborts first. */
  wait(ms: number, signal: AbortSignal): Promise<boolean>;
}

/** The shell's translation of the codec's errors into the sync engine's (anti-corruption). */
export function openFailureOf(error: TCodecError): TOpenFailure {
  switch (error.kind) {
    case 'aborted':
      return { kind: 'aborted' };
    case 'worker-crashed':
      return { kind: 'crashed' };
    case 'key-rotated':
      return { kind: 'key-rotated', keyId: null, stale: false };
    default:
      return { kind: 'unreadable' };
  }
}

/** A file under another key, read from its header: a later rotation, or an earlier key put back. */
function rotatedKeyOf(file: TBytes, keys: IVaultKeys): TOpenFailure {
  const decoded = decodeHeader(file);
  return decoded.ok
    ? {
        kind: 'key-rotated',
        keyId: toHex(decoded.value.header.keyId),
        stale: decoded.value.header.keyGeneration <= keys.keyGeneration,
      }
    : { kind: 'key-rotated', keyId: null, stale: false };
}

export async function fileHashOf(file: TBytes): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', file)));
}

async function headerOf(opened: IOpenedVault, file: TBytes): Promise<IOpenedHeader> {
  return {
    vaultId: toHex(opened.header.vaultId),
    keyId: toHex(opened.header.keyId),
    revision: opened.header.revision,
    keyslotsEpoch: opened.header.keyslotsEpoch,
    access: opened.access,
    movedTo: opened.header.movedTo,
    fileHash: await fileHashOf(file),
  };
}

function sealContext(keys: IVaultKeys, revision: number): ISealContext {
  return { ...keys, revision, movedTo: null };
}

/**
 * Runs one effect of a sync engine against its replica and
 * answers with the event the engine waits for; `null` when it waits for
 * none. No MobX and no timers of its own, so the portfolio session, the
 * extension's service worker and the model test share it.
 */
export async function runSyncEffect(
  effect: TSyncEffect,
  replica: ISyncReplica,
  signal: AbortSignal
): Promise<TSyncEvent | null> {
  switch (effect.kind) {
    case 'stat':
      return { kind: 'stat-done', result: await replica.provider.stat(replica.path, signal) };
    case 'read':
      return { kind: 'read-done', result: await replica.provider.read(replica.path, signal) };
    case 'open': {
      const fileVault = vaultKeyOf(effect.file);
      if (!isNil(fileVault) && fileVault !== toHex(replica.keys.vaultId)) {
        return { kind: 'opened', result: err({ kind: 'foreign-vault' }) };
      }
      const opened = await replica.codec.open(
        effect.file,
        { kind: 'session', dek: replica.keys.dek, keyId: replica.keys.keyId },
        signal
      );
      return {
        kind: 'opened',
        result: opened.ok
          ? ok({
              header: await headerOf(opened.value, effect.file),
              document: opened.value.document,
              keys: opened.value.keys,
            })
          : err(
              opened.error.kind === 'key-rotated'
                ? rotatedKeyOf(effect.file, replica.keys)
                : openFailureOf(opened.error)
            ),
      };
    }
    case 'merge':
      replica.adoptKeys(effect.keys);
      return {
        kind: 'merged',
        localHasNews:
          replica.merge(effect.remote) || replica.keys.keyslotsEpoch > effect.keys.keyslotsEpoch,
      };
    case 'seal': {
      const { keys } = replica;
      const sealed = await replica.codec.seal(
        replica.document(),
        replica.manifest,
        sealContext(keys, effect.revision),
        signal
      );
      if (!sealed.ok) {
        return {
          kind: 'seal-failed',
          failure: { kind: sealed.error.kind === 'aborted' ? 'aborted' : 'crashed' },
        };
      }
      return {
        kind: 'sealed',
        file: sealed.value,
        fileHash: await fileHashOf(sealed.value),
        keyslotsEpoch: keys.keyslotsEpoch,
      };
    }
    case 'write':
      return {
        kind: 'write-done',
        result: await replica.provider.write(
          replica.path,
          effect.file,
          effect.precondition,
          signal
        ),
      };
    case 'keys-shared':
      replica.keysShared(effect.keyslotsEpoch);
      return null;
    case 'save-guard':
      await replica.saveGuard(effect.guard, effect.lastSyncedRev);
      return null;
    case 'schedule-retry': {
      const unitRandom = (replica.random.bytes(1)[0] ?? 0) / 0xff;
      const waited = await replica.wait(retryDelay(effect.attempt, unitRandom), signal);
      return waited ? { kind: 'retry-due', attempt: effect.attempt } : null;
    }
    default:
      return assertNever(effect);
  }
}
