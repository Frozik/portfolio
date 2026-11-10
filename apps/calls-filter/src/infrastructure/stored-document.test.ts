import { z } from 'zod';

import type { IDocumentHistory } from './codecs/versioned-document';
import { sealDocument } from './codecs/versioned-document';
import type { IDocumentStore, IStoredDocument } from './stored-document';
import { loadDocument, saveDocument } from './stored-document';

const HISTORY: IDocumentHistory = { version: 2, migrations: { 1: data => data } };
const THEME: IStoredDocument<{ readonly theme: string }> = {
  key: 'preferences',
  history: HISTORY,
  parse: data => {
    const parsed = z.object({ theme: z.string() }).safeParse(data);
    return parsed.success ? parsed.data : null;
  },
};

function phone(stored: string | null) {
  const rows = new Map<string, string>(stored === null ? [] : [['preferences', stored]]);
  const events: string[] = [];
  const store: IDocumentStore = {
    read: async key => rows.get(key) ?? null,
    write: async (key, value) => {
      rows.set(key, value);
    },
    remove: async key => {
      rows.delete(key);
    },
  };
  const diagnostics = {
    log: (_level: string, _category: string, event: string) => events.push(event),
    latest: () => [],
  };
  return { store, diagnostics, row: () => rows.get('preferences') ?? null, events };
}

describe('a document of this phone, loaded', () => {
  it('reads one of the current version', async () => {
    const { store, diagnostics } = phone(sealDocument(HISTORY, { theme: 'dark' }));

    expect(await loadDocument(store, THEME, diagnostics)).toEqual({ theme: 'dark' });
  });

  it('writes an older one back at the current version right away, and says so', async () => {
    const { store, diagnostics, row, events } = phone(
      JSON.stringify({ version: 1, data: { theme: 'dark' } })
    );

    expect(await loadDocument(store, THEME, diagnostics)).toEqual({ theme: 'dark' });
    expect(row()).toBe(sealDocument(HISTORY, { theme: 'dark' }));
    expect(events).toEqual(['document-migrated']);
  });

  it('clears one it cannot read, and says so', async () => {
    const { store, diagnostics, row, events } = phone(sealDocument(HISTORY, { theme: 42 }));

    expect(await loadDocument(store, THEME, diagnostics)).toBeNull();
    expect(row()).toBeNull();
    expect(events).toEqual(['document-discarded']);
  });

  it('clears one a newer app wrote: on this phone only a downgrade leaves one', async () => {
    const { store, diagnostics, row } = phone(JSON.stringify({ version: 9, data: {} }));

    expect(await loadDocument(store, THEME, diagnostics)).toBeNull();
    expect(row()).toBeNull();
  });

  it('knows nothing of a document never written', async () => {
    const { store, diagnostics, events } = phone(null);

    expect(await loadDocument(store, THEME, diagnostics)).toBeNull();
    expect(events).toEqual([]);
  });

  it('saves a document at the current version', async () => {
    const { store, row } = phone(null);

    await saveDocument(store, THEME, { theme: 'light' });

    expect(row()).toBe(sealDocument(HISTORY, { theme: 'light' }));
  });
});
