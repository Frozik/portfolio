import type { Temporal } from 'temporal-polyfill';

import type { TCloudFailure } from './ports/cloud-copy';

/** Where syncing stands, as the settings and the banner say it. */
export type TSyncState =
  | { readonly kind: 'off' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'synced'; readonly at: Temporal.Instant }
  | { readonly kind: 'failed'; readonly failure: TCloudFailure; readonly since: Temporal.Instant }
  /** The cloud file is not a book this app reads: the cloud copy is left untouched. */
  | { readonly kind: 'unreadable' }
  /** The cloud copy is a newer app's: left untouched until this app is updated. */
  | { readonly kind: 'newer' };
