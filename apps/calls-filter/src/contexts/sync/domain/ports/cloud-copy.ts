import type { Brand } from '@frozik/utils/types/base';

import type { GroupBook } from '../../../grouping/domain/group-book';

/** The cloud's version of the file: a write names the one it read, or loses the race. */
export type TCloudRev = Brand<string, 'CloudRev'>;

/** Why the cloud could not be reached; each is a state the user may need to see. */
export type TCloudFailure = 'offline' | 'auth-required' | 'rate-limited' | 'server' | 'quota';

type TCloudRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'found'; readonly book: GroupBook; readonly rev: TCloudRev }
  /** The file is there but is not a group book this app can read: it is never overwritten blindly. */
  | { readonly kind: 'unreadable'; readonly rev: TCloudRev }
  | { readonly kind: 'failed'; readonly failure: TCloudFailure };

type TCloudWrite =
  | { readonly kind: 'written'; readonly rev: TCloudRev }
  /** Another phone wrote since this one read: read again and merge again. */
  | { readonly kind: 'conflict' }
  | { readonly kind: 'failed'; readonly failure: TCloudFailure };

/** The one copy of the group book in the user's own cloud. */
export interface ICloudCopy {
  read(): Promise<TCloudRead>;
  /** `rev` of the copy read, or `null` when there was none. */
  write(book: GroupBook, rev: TCloudRev | null): Promise<TCloudWrite>;
}
