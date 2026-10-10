import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';

/** sync.md §8.1 */
export type TStorageError =
  | { readonly kind: 'auth-required' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'cors-blocked' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'quota' }
  | { readonly kind: 'rate-limited'; readonly retryAfter: Milliseconds | null }
  | { readonly kind: 'server'; readonly status: number }
  | { readonly kind: 'aborted' };

export type TStorageResult<T> = TResult<T, TStorageError>;
