import type { TStorageResult } from '../core/storage-error';

/**
 * The provider's only view of Google sign-in. A token is asked
 * for inside a user gesture (GIS shows a popup), so the source hands out the
 * one it holds or says `auth-required`; it never opens a popup on its own.
 */
export interface IAccessTokenSource {
  token(signal: AbortSignal): Promise<TStorageResult<string>>;
  /** Google refused the token (expired, revoked): the next call needs a new gesture. */
  invalidate(): void;
}
