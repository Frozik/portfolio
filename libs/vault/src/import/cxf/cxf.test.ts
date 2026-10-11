import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { toBase64Url, utf8, utf8Text } from '../../crypto/bytes';
import { exportCxf } from '../../export/cxf/export-cxf';
import { packContainer, unpackContainer } from '../../format/container';
import type { IVaultCard } from '../../model/card';
import { allFields, fieldValues } from '../../model/card';
import type { IVaultDocument } from '../../model/vault-document';
import { emptyVaultDocument } from '../../model/vault-document';
import { anHlc } from '../../testing/builders';
import { sampleVaultDocument } from '../../testing/sample-vault';
import { createSeededRandom } from '../../testing/seeded-random';
import { applyImport } from '../apply-import';
import type { IImportBatch } from '../imported-card';
import { readImportFile } from '../read-import-file';
import { verifiedFiles } from '../verify-files';

const field = (value: string, fieldType = 'string') => ({ fieldType, value });
const SCAN = Uint8Array.of(1, 2, 3);
/** SHA-256 of SCAN. */
const SCAN_HASH = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81';

const HEADER = {
  version: { major: 1, minor: 0 },
  exporterRpId: 'exporter.example',
  exporterDisplayName: 'Exporter',
  timestamp: 1_760_000_000,
  accounts: [
    {
      id: 'YWNj',
      username: 'jane',
      email: 'jane@example.org',
      collections: [
        {
          id: 'Y29s',
          title: 'Work',
          items: [{ item: 'bG9naW4' }],
          subCollections: [{ id: 'c3Vi', title: 'Travel', items: [{ item: 'cGFzcw' }] }],
        },
      ],
      items: [
        {
          id: 'bG9naW4',
          creationAt: 1_700_000_000,
          title: 'GitHub',
          favorite: true,
          scope: { urls: ['https://github.com'], androidApps: [] },
          tags: ['dev'],
          credentials: [
            {
              type: 'basic-auth',
              username: field('jane'),
              password: field('s3cret', 'concealed-string'),
            },
            {
              type: 'totp',
              secret: 'JBSWY3DPEHPK3PXP',
              period: 30,
              digits: 6,
              algorithm: 'sha1',
              username: 'jane',
              issuer: 'GitHub',
            },
            { type: 'passkey', credentialId: 'AA', rpId: 'github.com', username: 'jane' },
            { type: 'item-reference', reference: { item: 'cGFzcw' } },
            { type: 'teleporter', coordinates: 'mars' },
          ],
        },
        {
          id: 'cGFzcw',
          title: 'Passport',
          credentials: [
            {
              type: 'passport',
              passportNumber: field('X1234567'),
              issueDate: field('2020-01-02', 'date'),
              expiryDate: field('2030-01-01', 'date'),
              birthDate: field('1990-05-06', 'date'),
            },
            {
              type: 'file',
              id: 'c2Nhbg',
              name: 'scan.pdf',
              decryptedSize: 3,
              integrityHash: toBase64Url(
                Uint8Array.from(SCAN_HASH.match(/../g) ?? [], pair => Number.parseInt(pair, 16))
              ),
            },
          ],
        },
        {
          id: 'd2lmaQ',
          title: 'Home Wi-Fi',
          credentials: [
            {
              type: 'wifi',
              ssid: field('home'),
              passphrase: field('wifi-pass', 'concealed-string'),
              networkSecurityType: field('wpa2-personal', 'wifi-network-security-type'),
              hidden: field('false', 'boolean'),
            },
            {
              type: 'custom-fields',
              fields: [{ fieldType: 'string', value: 'Router in the hall', label: 'Where' }],
            },
          ],
        },
      ],
    },
  ],
};

function batchOf(bytes: Uint8Array<ArrayBuffer>): IImportBatch {
  const read = readImportFile(bytes);
  assert(read.ok && read.value.kind === 'entries', 'a CXF file reads');
  return read.value.batch;
}

function imported(batch: IImportBatch): IVaultDocument {
  return applyImport(
    emptyVaultDocument('Imported', anHlc(1)),
    batch,
    { translate: key => key, random: createSeededRandom(1), duplicates: 'keep-both' },
    anHlc(2)
  ).document;
}

function valuesOf(card: IVaultCard | undefined): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    (isNil(card) ? [] : allFields(card)).map(entry => [entry.label, fieldValues(entry)])
  );
}

function cardTitled(document: IVaultDocument, title: string): IVaultCard | undefined {
  return [...document.cards.values()].find(card => card.title === title);
}

describe('the Credential Exchange Format', () => {
  const archive = packContainer([
    { path: 'cxf.json', bytes: utf8(JSON.stringify(HEADER)), compress: true },
    { path: 'documents/c2Nhbg', bytes: SCAN, compress: false },
  ]);

  it('brings items in on the template their main credential names, the rest as fields', () => {
    const document = imported(batchOf(archive));
    const github = cardTitled(document, 'GitHub');

    expect(github?.templateId).toBe('internet-account');
    expect(valuesOf(github)).toMatchObject({
      'field.login': ['jane'],
      'field.password': ['s3cret'],
      'field.websites': ['https://github.com'],
    });
    expect(valuesOf(github)['field.oneTimeCode']?.[0]).toMatch(
      /^otpauth:\/\/totp\/.*secret=JBSWY3DPEHPK3PXP/
    );
    expect(github?.favorite).toBe(true);
    expect(cardTitled(document, 'Passport')?.templateId).toBe('document');
    expect(valuesOf(cardTitled(document, 'Passport'))).toMatchObject({
      'field.documentNumber': ['X1234567'],
      'field.expiresOn': ['2030-01-01'],
      'field.birthDate': ['1990-05-06'],
    });
    expect(valuesOf(cardTitled(document, 'Home Wi-Fi'))).toMatchObject({
      'field.ssid': ['home'],
      'field.security': ['option.wpa2'],
      Where: ['Router in the hall'],
    });
  });

  it('turns collections and tags into groups, references into links, and keeps the files beside cxf.json', () => {
    const document = imported(batchOf(archive));
    const groupNames = (card: IVaultCard | undefined) =>
      (card?.groupIds ?? []).map(id => document.groups.get(id)?.name);

    expect(groupNames(cardTitled(document, 'GitHub'))).toEqual(['Work', 'dev']);
    expect(groupNames(cardTitled(document, 'Passport'))).toEqual(['Travel']);
    expect(document.links.size).toBe(1);
    expect([...document.assetBytes.values()]).toEqual([SCAN]);
  });

  it('reports passkeys and credential types it does not know', () => {
    expect(batchOf(archive).warnings).toEqual([
      { kind: 'passkey-dropped', card: 'GitHub' },
      { kind: 'field-dropped', card: 'GitHub', label: 'teleporter' },
    ]);
  });

  it('reads the header alone as JSON, the files then reported missing', () => {
    expect(batchOf(utf8(JSON.stringify(HEADER))).warnings).toContainEqual({
      kind: 'file-dropped',
      card: 'Passport',
      name: 'scan.pdf',
    });
  });

  it('exports the vault so that it comes back with its cards, values, groups and files', async () => {
    const source = sampleVaultDocument(createSeededRandom(42));
    const exported = await exportCxf(
      source,
      source.assetBytes,
      { rpId: 'vault.example', displayName: 'Vault', accountId: 'vault-1' },
      Temporal.Instant.from('2026-10-11T00:00:00Z').epochMilliseconds
    );

    const document = imported(batchOf(exported));

    const live = [...source.cards.values()].filter(card => isNil(card.trashedAt));
    expect([...document.cards.values()].map(card => card.title).sort()).toEqual(
      live.map(card => card.title).sort()
    );
    const everyValue = (cards: Iterable<IVaultCard>) =>
      [...cards].flatMap(card =>
        allFields(card)
          .flatMap(fieldValues)
          .filter(value => !value.startsWith('otpauth') && value.length > 0)
      );
    const sourceAssetIds = new Set<string>(source.assets.keys());
    const importedAssetIds = new Set<string>(document.assets.keys());
    const sourceValues = everyValue(live).filter(value => !sourceAssetIds.has(value));
    const importedValues = everyValue(document.cards.values()).filter(
      value => !importedAssetIds.has(value)
    );
    expect(new Set(importedValues)).toEqual(new Set(sourceValues));
    expect([...document.assetBytes.values()].length).toBe(source.assetBytes.size);
    expect([...document.groups.values()].map(group => group.name).sort()).toEqual(
      [...source.groups.values()].map(group => group.name).sort()
    );
  });

  it('leaves out a file whose bytes disagree with the hash the source declares, and says so', async () => {
    const batch = batchOf(archive);
    const damaged = {
      ...batch,
      assets: batch.assets.map(entry => ({ ...entry, bytes: Uint8Array.of(9, 9, 9) })),
    };

    const verified = await verifiedFiles(damaged);

    expect(verified.assets).toEqual([]);
    expect(verified.warnings).toContainEqual({
      kind: 'file-dropped',
      card: 'Passport',
      name: 'scan.pdf',
    });
  });

  it('keeps a Wi-Fi security choice readable on a card of another template', () => {
    const header = {
      ...HEADER,
      accounts: [
        {
          id: 'YWNj',
          items: [
            {
              id: 'Ym90aA',
              title: 'Card and hotspot',
              credentials: [
                { type: 'credit-card', number: field('4111111111111111', 'concealed-string') },
                {
                  type: 'wifi',
                  networkSecurityType: field('wpa2-personal', 'wifi-network-security-type'),
                },
              ],
            },
          ],
        },
      ],
    };
    const translate = (key: string) => (key === 'option.wpa2' ? 'WPA2' : key);

    const { document } = applyImport(
      emptyVaultDocument('Imported', anHlc(1)),
      batchOf(utf8(JSON.stringify(header))),
      { translate, random: createSeededRandom(1), duplicates: 'keep-both' },
      anHlc(2)
    );

    const card = cardTitled(document, 'Card and hotspot');
    const security = isNil(card)
      ? undefined
      : allFields(card).find(entry => entry.label === 'field.security');
    expect(security?.value).toEqual({ cardinality: 'single', value: 'WPA2' });
    expect(security?.spec.kind === 'select' && security.spec.options).toContain('WPA2');
  });

  it('exports references only to cards the file carries', async () => {
    const source = sampleVaultDocument(createSeededRandom(42));
    const [link] = source.links.values();
    assert(link !== undefined);
    const trashed = source.cards.get(link.b);
    assert(trashed !== undefined);
    const withTrash = {
      ...source,
      cards: new Map(source.cards).set(trashed.id, { ...trashed, trashedAt: anHlc(5) }),
    };

    const exported = await exportCxf(
      withTrash,
      source.assetBytes,
      { rpId: 'vault.example', displayName: 'Vault', accountId: 'vault-1' },
      Temporal.Instant.from('2026-10-11T00:00:00Z').epochMilliseconds
    );

    const entries = unpackContainer(exported);
    const json = entries.ok ? entries.value.get('cxf.json') : undefined;
    const written = isNil(json) ? '' : (utf8Text(json) ?? '');
    expect(written).not.toContain('item-reference');
  });

  it('carries a card’s colour, icon, protection and archive in its own extension', async () => {
    const source = sampleVaultDocument(createSeededRandom(42));
    const [first] = [...source.cards.values()].filter(card => isNil(card.trashedAt));
    assert(first !== undefined);
    const styled = {
      ...first,
      color: 'teal' as const,
      icon: { kind: 'builtin' as const, name: 'key' as const },
      protected: true,
      archivedAt: anHlc(3),
    };
    const exported = await exportCxf(
      { ...source, cards: new Map([[styled.id, styled]]) },
      new Map(),
      { rpId: 'vault.example', displayName: 'Vault', accountId: 'vault-1' },
      Temporal.Instant.from('2026-10-11T00:00:00Z').epochMilliseconds
    );

    const [card] = imported(batchOf(exported)).cards.values();

    expect(card).toMatchObject({
      color: 'teal',
      icon: { kind: 'builtin', name: 'key' },
      protected: true,
    });
    expect(card?.archivedAt).not.toBeNull();
  });
});
