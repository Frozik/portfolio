import type { Milliseconds } from '@frozik/utils/date/types';

import { utf8 } from '../crypto/bytes';
import { ARGON2_DEFAULT } from '../crypto/kdf-port';
import { encodePassword } from '../crypto/password-normalization';
import type { TManifest } from '../format/manifest';
import { CURRENT_SCHEMA_VERSION } from '../format/manifest';
import type { ISealContext, IVaultFileContent } from '../format/seal-vault';
import type { IVaultKeys } from '../format/vault-keys';
import { createVaultKeys } from '../format/vault-keys';
import { createFakeKdf } from './fake-kdf';
import { createSeededRandom } from './seeded-random';

export const TEST_PASSWORD = encodePassword('correct horse battery staple');

export function aManifest(overrides: Partial<TManifest> = {}): TManifest {
  return {
    format: 'pwv',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: '2026-10-11T00:00:00Z',
    createdBy: 'test device',
    ...overrides,
  };
}

export function aFileContent(overrides: Partial<IVaultFileContent> = {}): IVaultFileContent {
  return {
    manifest: aManifest(),
    entries: [
      { path: 'vault.json', bytes: utf8('{"name":"Test"}'), compress: true },
      { path: 'cards/one.json', bytes: utf8('{"title":"Bank"}'), compress: true },
      {
        path: 'assets/scan',
        bytes: Uint8Array.from({ length: 300 }, (_, index) => index % 251),
        compress: false,
      },
    ],
    ...overrides,
  };
}

/** A fresh vault on the fast fake KDF with seeded randomness: everything a format test needs to seal. */
export async function aVault(seed = 1): Promise<{
  readonly keys: IVaultKeys;
  readonly context: ISealContext;
  readonly dependencies: {
    readonly argon2: ReturnType<typeof createFakeKdf>;
    readonly random: ReturnType<typeof createSeededRandom>;
    readonly elapsed: () => Milliseconds;
  };
}> {
  const dependencies = {
    argon2: createFakeKdf(),
    random: createSeededRandom(seed),
    elapsed: () => 0 as Milliseconds,
  };
  const keys = await createVaultKeys(TEST_PASSWORD, ARGON2_DEFAULT, dependencies);
  return { keys, dependencies, context: { ...keys, revision: 1, movedTo: null } };
}
