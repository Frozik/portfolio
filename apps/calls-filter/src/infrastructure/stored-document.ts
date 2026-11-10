import { assertNever } from '@frozik/utils/assert/assertNever';

import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import type { IDocumentHistory } from './codecs/versioned-document';
import { openDocument, sealDocument } from './codecs/versioned-document';

/** Where this phone keeps its documents: one text per key. */
export interface IDocumentStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** A kind of document this phone keeps: its key, how it grew, and how its data is read. */
export interface IStoredDocument<T> {
  readonly key: string;
  readonly history: IDocumentHistory;
  /** The data at the current version as the app's value; `null` when it is not one. */
  readonly parse: (data: unknown) => T | null;
}

/**
 * A document of this phone at the current version. An older one is written back migrated at
 * once; one that cannot be read — or that a newer app wrote, which here only a downgrade
 * leaves — is cleared, so the app starts that part afresh rather than half-reading it.
 */
export async function loadDocument<T>(
  store: IDocumentStore,
  document: IStoredDocument<T>,
  diagnostics: Pick<IDiagnosticsLog, 'log'>
): Promise<T | null> {
  const text = await store.read(document.key);
  if (text === null) {
    return null;
  }
  const discard = async (reason: string) => {
    await store.remove(document.key);
    diagnostics.log('warn', 'app', 'document-discarded', { document: document.key, reason });
    return null;
  };
  const opened = openDocument(text, document.history);
  switch (opened.kind) {
    case 'newer':
      return discard(`newer:${opened.version}`);
    case 'unreadable':
      return discard(opened.reason);
    case 'current':
      return document.parse(opened.data) ?? discard('invalid');
    case 'migrated': {
      const value = document.parse(opened.data);
      if (value === null) {
        return discard('invalid-after-migration');
      }
      await store.write(document.key, sealDocument(document.history, opened.data));
      diagnostics.log('info', 'app', 'document-migrated', {
        document: document.key,
        from: String(opened.from),
      });
      return value;
    }
    default:
      return assertNever(opened);
  }
}

export async function saveDocument<T>(
  store: IDocumentStore,
  document: IStoredDocument<T>,
  data: unknown
): Promise<void> {
  await store.write(document.key, sealDocument(document.history, data));
}
