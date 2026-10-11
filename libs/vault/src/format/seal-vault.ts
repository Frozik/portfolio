import type { TBytes } from '../crypto/bytes';
import type { IRandom } from '../ports/random';
import type { IContainerEntry } from './container';
import { packContainer } from './container';
import { sealEnvelope } from './envelope';
import { DEFAULT_CHUNK_SIZE, SAVE_SALT_BYTES } from './header';
import type { ITlvRecord } from './header-tlv';
import type { TManifest } from './manifest';
import { encodeManifest, MANIFEST_PATH } from './manifest';
import type { IVaultKeys } from './vault-keys';

export interface IVaultFileContent {
  readonly manifest: TManifest;
  /** Every file of the container but the manifest. */
  readonly entries: readonly IContainerEntry[];
}

export interface ISealContext extends IVaultKeys {
  /** `max(remote, max seen) + 1`. */
  readonly revision: number;
  readonly movedTo: string | null;
  readonly preserved: readonly ITlvRecord[];
}

/**
 * Draws a fresh SAVE_SALT itself and takes no salt, header
 * or nonce from the caller, so two seals of the same content never share a
 * payload key.
 */
export function sealVaultFile(
  content: IVaultFileContent,
  context: ISealContext,
  random: IRandom
): Promise<TBytes> {
  const zip = packContainer([
    { path: MANIFEST_PATH, bytes: encodeManifest(content.manifest), compress: true },
    ...content.entries,
  ]);
  return sealEnvelope(
    context.dek,
    {
      vaultId: context.vaultId,
      revision: context.revision,
      saveSalt: random.bytes(SAVE_SALT_BYTES),
      chunkSize: DEFAULT_CHUNK_SIZE,
      keyCheck: context.keyCheck,
      keyId: context.keyId,
      keyslotsEpoch: context.keyslotsEpoch,
      keyGeneration: context.keyGeneration,
      keyslots: context.keyslots,
      movedTo: context.movedTo,
      preserved: context.preserved,
    },
    zip
  );
}
