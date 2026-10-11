import { isNil } from 'lodash-es';

import {
  addAsset,
  ASSET_MAX_BYTES,
  fileAssetIdsOf,
  VAULT_ASSETS_MAX_BYTES,
} from '../model/asset-edits';
import { allFields } from '../model/card';
import type { IVaultCard } from '../model/card';
import { createGroup } from '../model/group-edits';
import { hotpCounterKey } from '../model/hotp-counters';
import { linkedCardIds } from '../model/link-edits';
import { INTERNET_ACCOUNT_TEMPLATE } from '../model/templates/internet-account';
import type { IVaultDocument } from '../model/vault-document';
import { emptyVaultDocument } from '../model/vault-document';
import { anHlc } from '../testing/builders';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import type { TDuplicatePolicy } from './apply-import';
import { applyImport } from './apply-import';
import type { IImportBatch, IImportedCard } from './imported-card';
import { textLabel } from './imported-card';
import { importVaultDocument } from './pwv/import-vault';
import { extraField, fill, plainCard, templateTabs } from './template-card';

const AT = anHlc(1_800_000_000_000, 'device-b:1');
const random = createSeededRandom(7);

function account(title: string, url: string, login: string, password: string): IImportedCard {
  return plainCard(
    INTERNET_ACCOUNT_TEMPLATE,
    title,
    templateTabs(
      INTERNET_ACCOUNT_TEMPLATE,
      {
        'field.websites': fill([url]),
        'field.login': fill(login),
        'field.password': fill(password),
      },
      []
    )
  );
}

function batch(cards: readonly IImportedCard[], extra: Partial<IImportBatch> = {}): IImportBatch {
  return { source: 'chrome', cards, links: [], assets: [], warnings: [], ...extra };
}

function run(document: IVaultDocument, imported: IImportBatch, duplicates: TDuplicatePolicy) {
  return applyImport(document, imported, { translate: key => key, random, duplicates }, AT);
}

function passwordOf(card: IVaultCard): string {
  const field = allFields(card).find(candidate => candidate.spec.kind === 'password');
  return field?.value.cardinality === 'single' ? field.value.value : '';
}

const existing = run(
  emptyVaultDocument('Mine', anHlc(1)),
  batch([account('GitHub', 'https://github.com', 'Jane', 'old')]),
  'keep-both'
).document;
const again = batch([account('GitHub (new)', 'https://gist.github.com/x', 'jane', 'new')]);

describe('importing into a vault', () => {
  it('skips an entry for a site and login the vault already has', () => {
    const { document, result } = run(existing, again, 'skip');

    expect(result).toEqual({ added: 0, replaced: 0, skipped: 1, filesDropped: 0 });
    expect(document).toBe(existing);
  });

  it('replaces the card it duplicates, keeping the old version in history', () => {
    const { document, result } = run(existing, again, 'replace');
    const [card] = document.cards.values();

    expect(result.replaced).toBe(1);
    expect(document.cards.size).toBe(1);
    expect(card?.title).toBe('GitHub (new)');
    expect(isNil(card) ? '' : passwordOf(card)).toBe('new');
    expect(card?.history.map(revision => revision.snapshot.title)).toEqual(['GitHub']);
  });

  it('keeps what the source does not say when it replaces a card: protection, star, colour', () => {
    const marked = run(
      emptyVaultDocument('Mine', anHlc(1)),
      batch([
        {
          ...account('GitHub', 'https://github.com', 'jane', 'old'),
          protected: true,
          favorite: true,
          color: 'teal',
        },
      ]),
      'keep-both'
    ).document;
    const [card] = run(marked, again, 'replace').document.cards.values();

    expect(card).toMatchObject({ protected: true, favorite: true, color: 'teal' });
  });

  it('makes no group for an entry it skips', () => {
    const grouped = batch([
      {
        ...account('GitHub (new)', 'https://gist.github.com/x', 'jane', 'new'),
        groups: ['Archive'],
      },
    ]);
    const { document } = run(existing, grouped, 'skip');

    expect(document.groups.size).toBe(0);
  });

  it('keeps both when asked to', () => {
    const { document, result } = run(existing, again, 'keep-both');

    expect(result.added).toBe(1);
    expect(document.cards.size).toBe(2);
  });

  it('finds duplicates inside the file too', () => {
    const twice = batch([
      account('One', 'https://example.com', 'jane', 'a'),
      account('Two', 'https://www.example.com/login', 'JANE', 'b'),
    ]);

    expect(run(emptyVaultDocument('Mine', anHlc(1)), twice, 'skip').result).toMatchObject({
      added: 1,
      skipped: 1,
    });
  });

  it('puts cards into the groups of the same name, making the missing ones', () => {
    const work = createGroup(emptyVaultDocument('Mine', anHlc(1)), 'Work', anHlc(1), random);
    const grouped = batch([
      { ...account('A', 'https://a.example', 'a', '1'), groups: ['work', 'Family'] },
      { ...account('B', 'https://b.example', 'b', '2'), groups: ['Family'] },
    ]);
    const { document } = run(work.document, grouped, 'skip');

    expect([...document.groups.values()].map(group => group.name)).toEqual(['Work', 'Family']);
    const [first] = [...document.cards.values()];
    expect(first?.groupIds[0]).toBe(work.groupId);
  });

  it('dates a card when the source says so, never in the future', () => {
    const dated = batch([
      { ...account('Old', 'https://old.example', 'a', '1'), createdAtMs: 1_600_000_000_000 },
      { ...account('Odd', 'https://odd.example', 'b', '2'), createdAtMs: 1_900_000_000_000 },
    ]);
    const cards = [
      ...run(emptyVaultDocument('Mine', anHlc(1)), dated, 'skip').document.cards.values(),
    ];

    expect(cards.map(card => card.createdAt.wallMs)).toEqual([1_600_000_000_000, AT.wallMs]);
  });
});

describe('importing another vault', () => {
  const source = sampleVaultDocument(createSeededRandom(3));
  let imported: IImportBatch;
  beforeAll(async () => {
    imported = await importVaultDocument(source);
  });

  it('brings its cards outside the trash under new ids', () => {
    const { document } = run(emptyVaultDocument('Mine', anHlc(1)), imported, 'keep-both');
    const liveSource = [...source.cards.values()].filter(card => isNil(card.trashedAt));

    expect([...document.cards.values()].map(card => card.title).sort()).toEqual(
      liveSource.map(card => card.title).sort()
    );
    expect([...document.cards.keys()].some(id => source.cards.has(id))).toBe(false);
  });

  it('keeps its links and its files, renumbered', () => {
    const { document } = run(emptyVaultDocument('Mine', anHlc(1)), imported, 'keep-both');
    const linked = [...document.cards.values()].filter(
      card => linkedCardIds(document, card.id).length > 0
    );
    const fileIds = [...document.cards.values()].flatMap(card =>
      allFields(card).flatMap(fileAssetIdsOf)
    );

    expect(linked.length).toBe(
      2 * [...source.links.values()].filter(link => source.cards.has(link.a)).length
    );
    expect(fileIds.length).toBeGreaterThan(0);
    expect(fileIds.every(id => document.assetBytes.has(id))).toBe(true);
    expect(fileIds.some(id => source.assets.has(id))).toBe(false);
  });

  it('leaves a file out, and its field empty, when the vault has no room for it', () => {
    const full = Array.from({
      length: VAULT_ASSETS_MAX_BYTES / ASSET_MAX_BYTES,
    }).reduce<IVaultDocument>(
      current =>
        addAsset(
          current,
          {
            name: 'filler.bin',
            mime: 'application/octet-stream',
            sha256: '',
            bytes: new Uint8Array(ASSET_MAX_BYTES),
          },
          AT,
          random
        ).document,
      emptyVaultDocument('Mine', anHlc(1))
    );
    const { document, result } = run(full, imported, 'keep-both');

    expect(result.filesDropped).toBe(imported.assets.length);
    expect(
      [...document.cards.values()].flatMap(card => allFields(card).flatMap(fileAssetIdsOf))
    ).toEqual([]);
  });

  it('brings no files for the cards it skips as already here', () => {
    const scan = imported.assets[0];
    if (isNil(scan)) {
      throw new Error('the sample has a file');
    }
    const withScan = (title: string): IImportedCard => {
      const card = account(title, 'https://bank.example', 'jane', 'pw');
      const [tab] = card.tabs;
      return {
        ...card,
        tabs: [
          {
            ...tab,
            fields: [...tab.fields, extraField('file', textLabel('Scan'), [scan.asset.id])],
          },
        ],
      };
    };
    const once = run(
      emptyVaultDocument('Mine', anHlc(1)),
      batch([withScan('Bank')], { assets: [scan] }),
      'skip'
    ).document;
    const { document, result } = run(
      once,
      batch([withScan('Bank again')], { assets: [scan] }),
      'skip'
    );

    expect(result).toMatchObject({ skipped: 1, filesDropped: 0 });
    expect(document.assets.size).toBe(1);
  });

  it('carries on a HOTP counter from where the other vault left it', async () => {
    const [card] = source.cards.values();
    const [field] = isNil(card) ? [] : allFields(card);
    if (isNil(card) || isNil(field)) {
      throw new Error('the sample has cards');
    }
    const counted = await importVaultDocument({
      ...source,
      hotpCounters: new Map([[hotpCounterKey(card.id, field.id), 41]]),
    });
    const { document } = run(emptyVaultDocument('Mine', anHlc(1)), counted, 'keep-both');

    expect([...document.hotpCounters.values()]).toEqual([41]);
  });
});
