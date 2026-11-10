import type { TStorageError } from '@frozik/cloud-storage/core/storage-error';
import type {
  IStorageProvider,
  TStoragePath,
  TStorageRev,
} from '@frozik/cloud-storage/core/storage-provider';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type {
  ICloudCopy,
  TCloudFailure,
  TCloudRev,
} from '../contexts/sync/domain/ports/cloud-copy';
import { decodeGroupBook, encodeGroupBook } from './codecs/group-book-codec';

/** The one file in the app's hidden Drive folder. */
const FILE = 'calls-filter.json' as TStoragePath;

function failureOf(error: TStorageError): TCloudFailure {
  switch (error.kind) {
    case 'offline':
    case 'aborted':
      return 'offline';
    case 'auth-required':
      return 'auth-required';
    case 'rate-limited':
      return 'rate-limited';
    case 'quota':
      return 'quota';
    case 'server':
    case 'not-found':
    case 'cors-blocked':
    case 'unavailable':
      return 'server';
    default:
      return assertNever(error);
  }
}

/** The group book as a JSON file in Drive, written only over the revision it was read at. */
export function driveCloudCopy(storage: IStorageProvider): ICloudCopy {
  const signal = () => new AbortController().signal;
  return {
    async read() {
      const read = await storage.read(FILE, signal());
      if (!read.ok) {
        return { kind: 'failed', failure: failureOf(read.error) };
      }
      if (read.value === null) {
        return { kind: 'absent' };
      }
      const rev = read.value.stat.rev as string as TCloudRev;
      const decoded = decodeGroupBook(new TextDecoder().decode(read.value.bytes));
      if (decoded.ok) {
        return { kind: 'found', book: decoded.value.book, rev };
      }
      return decoded.error.kind === 'newer' ? { kind: 'newer' } : { kind: 'unreadable', rev };
    },
    async write(book, rev) {
      const bytes = new TextEncoder().encode(encodeGroupBook(book));
      const written = await storage.write(
        FILE,
        bytes,
        rev === null ? { kind: 'absent' } : { kind: 'match', rev: rev as string as TStorageRev },
        signal()
      );
      if (!written.ok) {
        return { kind: 'failed', failure: failureOf(written.error) };
      }
      return written.value.kind === 'ok'
        ? { kind: 'written', rev: written.value.stat.rev as string as TCloudRev }
        : { kind: 'conflict' };
    },
  };
}
