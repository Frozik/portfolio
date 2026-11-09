import { z } from 'zod';

import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import type { ISyncMemory, ISyncStore } from '../contexts/sync/domain/ports/sync-store';
import { decodeGroupBook, encodeGroupBook } from './codecs/group-book-codec';
import type { SqliteStore } from './sqlite-store';

const SYNC_KEY = 'sync';
const NOTHING: ISyncMemory = { connection: null, base: null };

const stored = z.object({
  connection: z.object({ account: z.string().nullable() }).nullable(),
  base: z.string().nullable(),
});

/** The sync connection and the last synced book, beside the book itself. */
export function sqliteSyncStore(store: SqliteStore, diagnostics: IDiagnosticsLog): ISyncStore {
  return {
    async load() {
      const text = await store.read(SYNC_KEY);
      if (text === null) {
        return NOTHING;
      }
      const parsed = stored.safeParse(JSON.parse(text));
      if (!parsed.success) {
        diagnostics.log('error', 'sync', 'memory-unreadable');
        return NOTHING;
      }
      const base = parsed.data.base === null ? null : decodeGroupBook(parsed.data.base);
      return {
        connection: parsed.data.connection,
        base: base?.ok === true ? base.value : null,
      };
    },
    async save(memory) {
      await store.write(
        SYNC_KEY,
        JSON.stringify({
          connection: memory.connection,
          base: memory.base === null ? null : encodeGroupBook(memory.base),
        })
      );
    },
  };
}
