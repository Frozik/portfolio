import { parseCsv } from '@frozik/utils/csv/csv';
import { unzipSync } from 'fflate';
import { isNil } from 'lodash-es';

import { utf8 } from '../crypto/bytes';
import { applyImport } from '../import/apply-import';
import { readImportFile } from '../import/read-import-file';
import { addAsset, fileAssetIdsOf } from '../model/asset-edits';
import { allFields } from '../model/card';
import { emptyVaultDocument } from '../model/vault-document';
import { aCardWith, aField, anHlc } from '../testing/builders';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import { exportCsv } from './csv/export-csv';
import { exportOpenZip } from './zip/export-zip';

const source = sampleVaultDocument(createSeededRandom(5));
const MANIFEST = {
  format: 'pwv' as const,
  schemaVersion: 1,
  createdAt: '2026-10-11T00:00:00Z',
  createdBy: 'test',
};

describe('exporting a vault', () => {
  it('writes accounts as Bitwarden logins and the rest as notes with their fields', () => {
    const rows = parseCsv(exportCsv(source));
    const byName = new Map(rows.slice(1).map(row => [row[3], row]));

    expect(rows[0]).toEqual([
      'folder',
      'favorite',
      'type',
      'name',
      'notes',
      'fields',
      'reprompt',
      'login_uri',
      'login_username',
      'login_password',
      'login_totp',
    ]);
    expect(byName.get('GitHub')?.slice(7)).toEqual([
      'https://github.com,https://gist.github.com',
      'octocat',
      'correct horse battery staple',
      '',
    ]);
    expect(byName.get('Visa Platinum')?.[2]).toBe('note');
    expect(byName.get('Visa Platinum')?.[5]).toContain('4111111111111111');
  });

  it('leaves the trash out of the CSV', () => {
    const trashed = [...source.cards.values()].filter(card => !isNil(card.trashedAt));
    const names = parseCsv(exportCsv(source)).map(row => row[3]);

    expect(trashed.every(card => !names.includes(card.title))).toBe(true);
  });

  it('reads its own CSV back as the same accounts', () => {
    const read = readImportFile(utf8(exportCsv(source)));
    if (!read.ok || read.value.kind !== 'entries') {
      throw new Error('the export reads back');
    }
    const { document } = applyImport(
      emptyVaultDocument('Again', anHlc(1)),
      read.value.batch,
      { translate: key => key, random: createSeededRandom(1), duplicates: 'keep-both' },
      anHlc(2)
    );
    const github = [...document.cards.values()].find(card => card.title === 'GitHub');

    expect(isNil(github) ? [] : allFields(github).map(field => field.value)).toEqual(
      expect.arrayContaining([
        { cardinality: 'list', values: ['https://github.com', 'https://gist.github.com'] },
        { cardinality: 'single', value: 'octocat' },
        { cardinality: 'single', value: 'correct horse battery staple' },
      ])
    );
  });

  it('reads its CSV back as the same account: the email as login, a secret still masked', () => {
    const account = aCardWith(
      [
        aField({ kind: 'url', match: 'host', useSharedCredentials: true }, [
          'https://shop.example',
        ]),
        aField({ kind: 'email' }, 'me@shop.example', { label: 'Email' }),
        aField({ kind: 'password', rotateEveryDays: null }, 'pw', {
          label: 'Password',
          sensitive: true,
        }),
        aField({ kind: 'multiline' }, 'line1\nline2: x', { label: 'Address' }),
        aField({ kind: 'secret' }, 'recovery', { label: 'Recovery', sensitive: true }),
      ],
      { title: 'Shop' }
    );
    const document = {
      ...emptyVaultDocument('Mine', anHlc(1)),
      cards: new Map([[account.id, account]]),
    };
    const read = readImportFile(utf8(exportCsv(document)));
    if (!read.ok || read.value.kind !== 'entries') {
      throw new Error('the export reads back');
    }
    const context = { translate: (key: string) => key, random: createSeededRandom(1) };
    const again = applyImport(
      document,
      read.value.batch,
      { ...context, duplicates: 'skip' },
      anHlc(2)
    );
    const fresh = applyImport(
      emptyVaultDocument('New', anHlc(1)),
      read.value.batch,
      { ...context, duplicates: 'skip' },
      anHlc(2)
    );
    const [card] = fresh.document.cards.values();
    const fields = isNil(card) ? [] : allFields(card);

    expect(again.result.skipped).toBe(1);
    expect(fields.map(field => field.label)).not.toContain('line2');
    expect(fields.find(field => field.label === 'Recovery')?.sensitive).toBe(true);
  });

  it('gives every file of a card its own name in the open zip', () => {
    let document = emptyVaultDocument('Mine', anHlc(1));
    const ids = ['a.txt', 'a.txt', 'a (2).txt', 'A.TXT'].map((name, index) => {
      const added = addAsset(
        document,
        { name, mime: 'text/plain', sha256: '', bytes: Uint8Array.of(index) },
        anHlc(1),
        createSeededRandom(index)
      );
      document = added.document;
      return added.assetId;
    });
    const card = aCardWith([aField({ kind: 'file' }, ids)]);
    document = { ...document, cards: new Map([[card.id, card]]) };

    const files = Object.keys(unzipSync(exportOpenZip(document, MANIFEST))).filter(path =>
      path.startsWith(`cards/${card.id}/files/`)
    );

    expect(files).toHaveLength(4);
  });

  it('opens with any archiver: the container plus each card’s files under their names', () => {
    const entries = unzipSync(exportOpenZip(source, MANIFEST));
    const withFile = [...source.cards.values()].find(card =>
      allFields(card).some(field => fileAssetIdsOf(field).length > 0)
    );
    const [assetId] = isNil(withFile) ? [] : allFields(withFile).flatMap(fileAssetIdsOf);
    const asset = isNil(assetId) ? undefined : source.assets.get(assetId);

    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining(['manifest.json', 'vault.json', `cards/${withFile?.id}.json`])
    );
    expect(entries[`cards/${withFile?.id}/files/${asset?.name}`]).toEqual(
      isNil(assetId) ? undefined : source.assetBytes.get(assetId)
    );
  });
});
