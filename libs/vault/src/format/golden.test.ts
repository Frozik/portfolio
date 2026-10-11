import { assert } from '@frozik/utils/assert/assert';

import futureSchemaFile from '../../fixtures/v1.0/future-schema.pwv?inline';
import sampleFile from '../../fixtures/v1.0/sample.pwv?inline';
import { HASH_WASM_KDF } from '../crypto/adapters/kdf-hash-wasm';
import { utf8 } from '../crypto/bytes';
import { allFields } from '../model/card';
import {
  bytesOfDataUrl,
  FUTURE_PARTS,
  GOLDEN_PASSWORD,
  GOLDEN_SAMPLE_SEED,
} from '../testing/golden-fixtures';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import { decodeDocument } from './document-codec';
import { openVaultFile } from './open-vault';

const unlock = { kind: 'password', password: GOLDEN_PASSWORD } as const;

async function openGolden(dataUrl: string) {
  const opened = await openVaultFile(bytesOfDataUrl(dataUrl), unlock, HASH_WASM_KDF);
  assert(opened.ok);
  const document = decodeDocument(opened.value.entries);
  assert(document.ok);
  return { ...opened.value, document: document.value };
}

/**
 * Files written by format v1.0 open in every later build. A
 * failure here means the format changed: either a compatibility bug, or a
 * deliberate new version that needs its own fixtures.
 */
describe('golden vault files v1.0', () => {
  it('opens sample.pwv with its password to the sample vault', async () => {
    const opened = await openGolden(sampleFile);
    const expected = sampleVaultDocument(createSeededRandom(GOLDEN_SAMPLE_SEED));

    expect(opened.access).toBe('read-write');
    expect(opened.document.cards).toEqual(expected.cards);
    expect(opened.document.groups).toEqual(expected.groups);
    expect(opened.document.links).toEqual(expected.links);
    expect(opened.document.tombstones).toEqual(expected.tombstones);
    expect(opened.document.assetBytes).toEqual(expected.assetBytes);
  });

  it('opens a file of a newer schema read-only, showing what it does not know as such', async () => {
    const opened = await openGolden(futureSchemaFile);
    const unknownSpecs = [...opened.document.cards.values()]
      .flatMap(card => allFields(card))
      .filter(field => field.spec.kind === 'unknown')
      .map(field => field.spec);

    expect(opened.access).toBe('read-only');
    expect(opened.manifest).toMatchObject(FUTURE_PARTS.manifestKey);
    expect(unknownSpecs).toEqual([
      { kind: 'unknown', raw: FUTURE_PARTS.fieldSpec },
      { kind: 'unknown', raw: FUTURE_PARTS.bankCodeSpec },
    ]);
    expect(opened.header.preserved).toEqual([
      { type: FUTURE_PARTS.tlv.type, skippable: true, value: utf8(FUTURE_PARTS.tlv.text) },
    ]);
  });
});
