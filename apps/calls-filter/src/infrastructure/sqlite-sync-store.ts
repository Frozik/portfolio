import { z } from 'zod';

import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import type { ISyncMemory, ISyncStore } from '../contexts/sync/domain/ports/sync-store';
import { decodeGroupBook, encodeGroupBook } from './codecs/group-book-codec';
import type { SqliteStore } from './sqlite-store';
import type { IStoredDocument } from './stored-document';
import { loadDocument, saveDocument } from './stored-document';

const NOTHING: ISyncMemory = { connection: null, base: null };

const stored = z.object({
  connection: z.object({ account: z.string().nullable() }).nullable(),
  /** The last synced book, as the book's own versioned text. */
  base: z.string().nullable(),
});

/** Version 1 put the sync memory under a version; version 0 was the bare object. */
export const SYNC_DOCUMENT: IStoredDocument<ISyncMemory> = {
  key: 'sync',
  history: { version: 1, migrations: { 0: data => data } },
  parse: data => {
    const parsed = stored.safeParse(data);
    if (!parsed.success) {
      return null;
    }
    const base = parsed.data.base === null ? null : decodeGroupBook(parsed.data.base);
    return {
      connection: parsed.data.connection,
      base: base?.ok === true ? base.value.book : null,
    };
  },
};

/** The sync connection and the last synced book, beside the book itself. */
export function sqliteSyncStore(store: SqliteStore, diagnostics: IDiagnosticsLog): ISyncStore {
  return {
    load: async () => (await loadDocument(store, SYNC_DOCUMENT, diagnostics)) ?? NOTHING,
    save: memory =>
      saveDocument(store, SYNC_DOCUMENT, {
        connection: memory.connection,
        base: memory.base === null ? null : encodeGroupBook(memory.base),
      }),
  };
}
