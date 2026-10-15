/**
 * Writes the golden vault files. They freeze the format: run
 * this only on purpose, when a fixture must change, and review the diff.
 *   pnpm --filter @frozik/vault run generate-fixtures
 */
import { writeFileSync } from 'node:fs';

import { HASH_WASM_KDF } from '../src/crypto/adapters/kdf-hash-wasm';
import { utf8 } from '../src/crypto/bytes';
import { ARGON2_FLOOR } from '../src/crypto/kdf-port';
import type { IContainerEntry } from '../src/format/container';
import { encodeDocument } from '../src/format/document-codec';
import { CURRENT_SCHEMA_VERSION } from '../src/format/manifest';
import type { TManifest } from '../src/format/manifest';
import { sealVaultFile } from '../src/format/seal-vault';
import { createVaultKeys } from '../src/format/vault-keys';
import {
  FUTURE_PARTS,
  GOLDEN_CREATED_AT,
  GOLDEN_KEYS_SEED,
  GOLDEN_PASSWORD,
  GOLDEN_SAMPLE_SEED,
} from '../src/testing/golden-fixtures';
import { sampleVaultDocument } from '../src/testing/sample-vault';
import { createSeededRandom } from '../src/testing/seeded-random';

const OUTPUT = new URL('../fixtures/v1.0/', import.meta.url);

function withFutureCard(entries: readonly IContainerEntry[]): readonly IContainerEntry[] {
  const index = entries.findIndex(entry => entry.path.startsWith('cards/'));
  const entry = entries[index];
  if (entry === undefined) {
    throw new Error('The sample vault has no card');
  }
  const card = JSON.parse(new TextDecoder().decode(entry.bytes));
  card.tabs[0].fields.push(
    {
      id: 'future-field',
      label: 'Passkey',
      spec: FUTURE_PARTS.fieldSpec,
      value: { cardinality: 'single', value: 'opaque' },
      sensitive: true,
      excludeFromAudit: false,
    },
    {
      id: 'future-bank-code',
      label: 'CLABE',
      spec: FUTURE_PARTS.bankCodeSpec,
      value: { cardinality: 'single', value: '002010077777777771' },
      sensitive: false,
      excludeFromAudit: false,
    }
  );
  const future = { ...entry, bytes: utf8(JSON.stringify({ ...card, ...FUTURE_PARTS.cardKey })) };
  return [...entries.slice(0, index), future, ...entries.slice(index + 1)];
}

async function main(): Promise<void> {
  const random = createSeededRandom(GOLDEN_KEYS_SEED);
  const keys = await createVaultKeys(GOLDEN_PASSWORD, ARGON2_FLOOR, {
    argon2: HASH_WASM_KDF,
    random,
  });
  const context = { ...keys, revision: 1, movedTo: null };
  const entries = encodeDocument(sampleVaultDocument(createSeededRandom(GOLDEN_SAMPLE_SEED)));
  const manifest: TManifest = {
    format: 'pwv',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: GOLDEN_CREATED_AT,
    createdBy: 'golden fixture generator',
  };

  writeFileSync(
    new URL('sample.pwv', OUTPUT),
    await sealVaultFile({ manifest, entries }, context, random)
  );
  writeFileSync(
    new URL('future-schema.pwv', OUTPUT),
    await sealVaultFile(
      {
        manifest: {
          ...manifest,
          schemaVersion: CURRENT_SCHEMA_VERSION + 1,
          ...FUTURE_PARTS.manifestKey,
        },
        entries: [
          ...withFutureCard(entries),
          { path: FUTURE_PARTS.file.path, bytes: utf8(FUTURE_PARTS.file.text), compress: true },
        ],
      },
      {
        ...context,
        revision: 2,
        preserved: [
          {
            type: FUTURE_PARTS.tlv.type,
            skippable: FUTURE_PARTS.tlv.skippable,
            value: utf8(FUTURE_PARTS.tlv.text),
          },
        ],
      },
      random
    )
  );
}

await main();
