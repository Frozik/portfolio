import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import type { GroupBook } from '../contexts/grouping/domain/group-book';
import type { IGroupBookRepository } from '../contexts/grouping/domain/ports/group-book-repository';
import { decodeGroupBook, encodeGroupBook } from './codecs/group-book-codec';
import type { SqliteStore } from './sqlite-store';

const BOOK_KEY = 'group-book';

export function sqliteGroupBookRepository(
  store: SqliteStore,
  diagnostics: IDiagnosticsLog
): IGroupBookRepository {
  return {
    async load() {
      const text = await store.read(BOOK_KEY);
      if (text === null) {
        return null;
      }
      const decoded = decodeGroupBook(text);
      if (!decoded.ok) {
        // Only a downgrade leaves a newer book on this phone.
        await store.remove(BOOK_KEY);
        diagnostics.log('error', 'app', 'document-discarded', {
          document: BOOK_KEY,
          reason: decoded.error.kind,
        });
        return null;
      }
      const { book, migratedFrom } = decoded.value;
      if (migratedFrom !== null) {
        await store.write(BOOK_KEY, encodeGroupBook(book));
        diagnostics.log('info', 'app', 'document-migrated', {
          document: BOOK_KEY,
          from: String(migratedFrom),
        });
      }
      return book;
    },
    async save(book: GroupBook) {
      await store.write(BOOK_KEY, encodeGroupBook(book));
    },
  };
}
