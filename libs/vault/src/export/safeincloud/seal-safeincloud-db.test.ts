import { assert } from '@frozik/utils/assert/assert';

import sampleFile from '../../../fixtures/safeincloud/sample.db?inline';
import { readSafeInCloudDb } from '../../import/safeincloud/read-safeincloud-db';
import { putCard } from '../../model/card-edits';
import { emptyVaultDocument } from '../../model/vault-document';
import { aCardWith, aField, anHlc } from '../../testing/builders';
import { bytesOfDataUrl } from '../../testing/golden-fixtures';
import { createSeededRandom } from '../../testing/seeded-random';
import { exportSafeInCloud } from './export-safeincloud';
import { sealSafeInCloudDb } from './seal-safeincloud-db';

const PASSWORD = 'correct horse';
const HEADER_FIELDS = 4;

/** Each header field's length, as the bytes after the magic and the password flag say. */
function headerLengths(file: Uint8Array): readonly number[] {
  const lengths: number[] = [];
  let at = 3;
  for (let field = 0; field < HEADER_FIELDS; field += 1) {
    const length = file[at] ?? 0;
    lengths.push(length);
    at += length + 1;
  }
  return lengths;
}

describe('a SafeInCloud database written by the export', () => {
  it('lays out its header as a database the app itself wrote', async () => {
    const ours = await sealSafeInCloudDb('<database/>', PASSWORD, createSeededRandom(1));

    expect([...ours.slice(0, 3), ...headerLengths(ours)]).toEqual([
      ...bytesOfDataUrl(sampleFile).slice(0, 3),
      ...headerLengths(bytesOfDataUrl(sampleFile)),
    ]);
  });

  it('opens with its password into the vault’s cards, and not with another', async () => {
    const card = aCardWith(
      [
        aField({ kind: 'login' }, 'jane'),
        aField({ kind: 'password', rotateEveryDays: null }, 'hunter2', { sensitive: true }),
      ],
      { title: 'Bank' }
    );
    const xml = exportSafeInCloud(putCard(emptyVaultDocument('Home', anHlc(1)), card));
    const file = await sealSafeInCloudDb(xml, PASSWORD, createSeededRandom(2));

    const read = await readSafeInCloudDb(file, PASSWORD);
    assert(read.ok);

    expect({
      titles: read.value.cards.map(imported => imported.title),
      wrong: await readSafeInCloudDb(file, 'not it'),
    }).toEqual({ titles: ['Bank'], wrong: { ok: false, error: 'wrong-password' } });
  });
});
