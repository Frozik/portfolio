import { assert } from '@frozik/utils/assert/assert';
import * as fc from 'fast-check';

import { utf8, utf8Text } from '../crypto/bytes';
import { allFields } from '../model/card';
import type { TCardId } from '../model/ids';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import type { IContainerEntry } from './container';
import { decodeDocument, encodeDocument } from './document-codec';

function asFiles(entries: readonly IContainerEntry[]): Map<string, Uint8Array<ArrayBuffer>> {
  return new Map(entries.map(entry => [entry.path, entry.bytes]));
}

function json(files: ReadonlyMap<string, Uint8Array>, path: string): Record<string, unknown> {
  const bytes = files.get(path);
  assert(bytes !== undefined);
  return JSON.parse(utf8Text(bytes) ?? 'null') as Record<string, unknown>;
}

describe('document codec', () => {
  const document = sampleVaultDocument(createSeededRandom(42));

  it('reads back exactly the document it wrote', () => {
    const decoded = decodeDocument(asFiles(encodeDocument(document)));

    assert(decoded.ok);
    expect(decoded.value.cards).toEqual(document.cards);
    expect(decoded.value.groups).toEqual(document.groups);
    expect(decoded.value.links).toEqual(document.links);
    expect(decoded.value.tombstones).toEqual(document.tombstones);
    expect(decoded.value.assets).toEqual(document.assets);
    expect(decoded.value.assetBytes).toEqual(document.assetBytes);
    expect(decoded.value.settings).toEqual(document.settings);
  });

  it('stores a scan as is and the JSON compressed', () => {
    const entries = encodeDocument(document);

    expect(entries.find(entry => entry.path.startsWith('assets/'))?.compress).toBe(false);
    expect(entries.find(entry => entry.path === 'vault.json')?.compress).toBe(true);
  });

  it('reads what a newer version wrote instead of calling it damage: unknown kinds and parameters become read-only fields', () => {
    const files = asFiles(encodeDocument(document));
    const [cardPath] = [...files.keys()].filter(path => path.startsWith('cards/'));
    assert(cardPath !== undefined);
    const card = json(files, cardPath);
    const [tab] = card.tabs as { fields: Record<string, unknown>[] }[];
    assert(tab !== undefined);
    const futureField = (id: string, spec: Record<string, unknown>): Record<string, unknown> => ({
      id,
      label: id,
      spec,
      value: { cardinality: 'single', value: 'opaque' },
      sensitive: false,
      excludeFromAudit: false,
    });
    const passkey = { kind: 'passkey', rpId: 'example.com' };
    const clabe = { kind: 'bank-code', scheme: 'clabe' };
    const fields = [...tab.fields, futureField('passkey', passkey), futureField('clabe', clabe)];
    files.set(
      cardPath,
      utf8(JSON.stringify({ ...card, tabs: [{ ...tab, fields }], futureCardKey: 'ignored' }))
    );
    files.set('future/index.bin', utf8('?'));

    const decoded = decodeDocument(files);

    assert(decoded.ok);
    const read = decoded.value.cards.get(String(card.id) as TCardId);
    assert(read !== undefined);
    expect(
      allFields(read)
        .slice(-2)
        .map(field => field.spec)
    ).toEqual([
      { kind: 'unknown', raw: passkey },
      { kind: 'unknown', raw: clabe },
    ]);
  });

  it('reads a password written before passwords had a period as one without a period', () => {
    const files = asFiles(encodeDocument(document));
    const [cardPath] = [...files.keys()].filter(path => path.startsWith('cards/'));
    assert(cardPath !== undefined);
    const card = json(files, cardPath);
    const [tab] = card.tabs as { fields: Record<string, unknown>[] }[];
    assert(tab !== undefined);
    const earlier = {
      id: 'earlier',
      label: 'Password',
      spec: { kind: 'password' },
      value: { cardinality: 'single', value: 'hunter2' },
      sensitive: true,
      excludeFromAudit: false,
    };
    files.set(
      cardPath,
      utf8(JSON.stringify({ ...card, tabs: [{ ...tab, fields: [...tab.fields, earlier] }] }))
    );

    const decoded = decodeDocument(files);

    assert(decoded.ok);
    const read = decoded.value.cards.get(String(card.id) as TCardId);
    assert(read !== undefined);
    expect(allFields(read).at(-1)?.spec).toEqual({ kind: 'password', rotateEveryDays: null });
  });

  it('answers any file contents with a document or "corrupted", never an exception', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(
            'vault.json',
            'links.json',
            'tombstones.json',
            'assets.json',
            'hotp-counters.json',
            'cards/x.json'
          ),
          fc.json()
        ),
        contents => {
          const files = new Map(Object.entries(contents).map(([path, text]) => [path, utf8(text)]));
          const result = decodeDocument(files);
          return result.ok || result.error === 'corrupted';
        }
      ),
      { seed: 20261011 }
    );
  });

  it('calls a damaged card or a card under another name corrupted', () => {
    const files = asFiles(encodeDocument(document));
    const [cardPath] = [...files.keys()].filter(path => path.startsWith('cards/'));
    assert(cardPath !== undefined);

    const damaged = new Map(files).set(cardPath, utf8('{"title": 1}'));
    const renamed = new Map(files);
    renamed.delete(cardPath);
    renamed.set('cards/someone-else.json', files.get(cardPath) ?? new Uint8Array());

    expect(decodeDocument(damaged)).toEqual({ ok: false, error: 'corrupted' });
    expect(decodeDocument(renamed)).toEqual({ ok: false, error: 'corrupted' });
    expect(decodeDocument(new Map())).toEqual({ ok: false, error: 'corrupted' });
  });
});
