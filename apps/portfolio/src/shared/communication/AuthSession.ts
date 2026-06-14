import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';
import type { IOidcProvider } from './oidc/IOidcProvider';
import type { IOidcProfile, IOidcSignInResult } from './oidc/types';

interface IExpiringJwtPayload {
  /** Unix epoch seconds. */
  readonly exp: number;
  /** Unix epoch seconds. */
  readonly iat: number;
}

export interface IProfileSnapshot extends IOidcProfile {}

/**
 * Storage key used to persist the active sign-in across page reloads.
 * `sessionStorage` (not `localStorage`) so a tab close fully signs the
 * user out — matches the public-facing portfolio threat model.
 *
 * The legacy key (pre-multi-provider) stored a bare JWT string. The
 * v2 layout stores a JSON envelope `{ provider, token }`
 * — `setIdToken` parses both shapes for backward compatibility on
 * first reload after deploy.
 */
const STORAGE_KEY = 'communication.auth.idToken';

const SECONDS_TO_MS = 1_000;

/**
 * Schedule a proactive silent refresh this many milliseconds before
 * the JWT `exp`. Wide enough that a slow round-trip (FedCM dialog,
 * Yandex `/info?format=jwt` fetch) still completes before the server
 * emits `auth:token-expiring`, which itself fires a few seconds before
 * the actual expiry.
 */
const PROACTIVE_REFRESH_LEAD_MS = 60_000;

/** Lower bound on the proactive refresh delay — never schedule for the past. */
const MIN_REFRESH_DELAY_MS = 1_000;

interface IStoredSession {
  readonly provider: TIdentityProvider;
  readonly token: string;
}

/**
 * Lookup of provider → silent-refresh runner. Installed by
 * `<CommunicationProvider>` once the matching SDKs / popup wiring are
 * ready; cleared on unmount.
 */
type TRefreshLookup = ReadonlyMap<TIdentityProvider, IOidcProvider>;

/**
 * Browser-side auth state. Provider-agnostic: holds whichever JWT was
 * last issued by Google or Yandex sign-in flows plus a decoded profile
 * snapshot. The communication client picks `provider` and `token` off
 * this object on every Socket.IO handshake.
 */
export class AuthSession {
  public token: string | null = null;
  public provider: TIdentityProvider | null = null;
  public profile: IProfileSnapshot | null = null;
  public expiresAtMs: number | null = null;

  private providers: TRefreshLookup | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightRefresh: Promise<string | null> | null = null;

  public constructor() {
    makeAutoObservable<AuthSession, 'providers' | 'refreshTimer' | 'inFlightRefresh'>(
      this,
      {
        // Internal lifecycle plumbing — not observable UI state. Marking
        // these non-observable lets us assign them outside `runInAction`
        // without tripping MobX strict-mode warnings.
        providers: false,
        refreshTimer: false,
        inFlightRefresh: false,
      },
      { autoBind: true }
    );
    this.rehydrate();
  }

  public get isSignedIn(): boolean {
    return this.token !== null && this.expiresAtMs !== null && this.expiresAtMs > Date.now();
  }

  public get currentProvider(): TIdentityProvider | null {
    return this.provider;
  }

  /**
   * Install the per-provider silent-refresh runners. Called by
   * `<CommunicationProvider>` once provider SDKs (GIS) are loaded.
   * Re-installing replaces the previous lookup — handlers do not
   * accumulate.
   */
  public setProviders(providers: TRefreshLookup): void {
    this.providers = providers;
    // Re-derive `profile` if we rehydrated a token but had no provider
    // available yet. Doing this inside `setProviders` keeps callers
    // simple — they don't have to remember to call `completeRehydrate`
    // separately after wiring providers.
    this.completeRehydrate();
    this.scheduleProactiveRefresh();
  }

  public clearProviders(): void {
    this.providers = null;
    this.cancelProactiveRefresh();
  }

  /**
   * On-demand silent refresh. Used by `CommunicationClient` when the
   * server emits `auth:token-expiring`, and internally by the
   * proactive timer. Returns the new token, or `null` when no provider
   * is installed / the active provider declined to issue one.
   */
  public requestRefresh(): Promise<string | null> {
    if (this.inFlightRefresh !== null) {
      return this.inFlightRefresh;
    }
    if (this.providers === null || this.provider === null) {
      return Promise.resolve(null);
    }
    const provider = this.providers.get(this.provider);
    if (provider === undefined) {
      return Promise.resolve(null);
    }
    const loginHint = this.profile?.email;
    const promise = (async () => {
      let nextResult: IOidcSignInResult | null;
      try {
        nextResult = await provider.silentRefresh(loginHint);
      } catch {
        nextResult = null;
      }
      if (nextResult !== null) {
        this.adoptResult(provider.id, nextResult);
        return nextResult.token;
      }
      return null;
    })().finally(() => {
      this.inFlightRefresh = null;
    });
    this.inFlightRefresh = promise;
    return promise;
  }

  /**
   * Adopt a freshly issued sign-in result. The token is decoded only
   * for `exp` extraction; the canonical profile comes from the
   * provider implementation (which already understands its own claim
   * shape).
   */
  public adoptResult(provider: TIdentityProvider, result: IOidcSignInResult): void {
    let payload: IExpiringJwtPayload;
    try {
      payload = decodeExpiry(result.token);
    } catch {
      this.signOut();
      return;
    }
    runInAction(() => {
      this.provider = provider;
      this.token = result.token;
      this.profile = result.profile;
      this.expiresAtMs = payload.exp * SECONDS_TO_MS;
    });
    persistSession({ provider, token: result.token });
    this.scheduleProactiveRefresh();
  }

  public signOut(): void {
    // Forward sign-out to every registered provider so their internal
    // caches (Yandex' OAuth access_token in particular) get cleared.
    if (this.providers !== null) {
      for (const provider of this.providers.values()) {
        provider.signOut?.();
      }
    }
    runInAction(() => {
      this.provider = null;
      this.token = null;
      this.profile = null;
      this.expiresAtMs = null;
    });
    clearSession();
    this.cancelProactiveRefresh();
  }

  private rehydrate(): void {
    let stored: string | null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (isNil(stored)) {
      return;
    }
    const parsed = parseStoredSession(stored);
    if (parsed === null) {
      // Malformed entry — wipe so the next sign-in starts clean.
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore.
      }
      return;
    }
    let payload: IExpiringJwtPayload;
    try {
      payload = decodeExpiry(parsed.token);
    } catch {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore.
      }
      return;
    }
    runInAction(() => {
      this.provider = parsed.provider;
      this.token = parsed.token;
      this.expiresAtMs = payload.exp * SECONDS_TO_MS;
      // Profile is left null until a provider is registered — the
      // bridge re-decodes it via `decodeProfile` so we don't have to
      // duplicate per-provider claim logic in this file.
    });
  }

  /**
   * Re-derive `profile` from the rehydrated token using the matching
   * provider. Called by the React bridge once the provider lookup is
   * available — separates the "I have a token" state from the "I know
   * how to decode that token" state.
   */
  public completeRehydrate(): void {
    if (this.provider === null || this.token === null || this.profile !== null) {
      return;
    }
    if (this.providers === null) {
      return;
    }
    const provider = this.providers.get(this.provider);
    if (provider === undefined) {
      return;
    }
    let profile: IOidcProfile;
    try {
      profile = provider.decodeProfile(this.token);
    } catch {
      this.signOut();
      return;
    }
    runInAction(() => {
      this.profile = profile;
    });
  }

  private scheduleProactiveRefresh(): void {
    this.cancelProactiveRefresh();
    if (this.providers === null || this.expiresAtMs === null) {
      return;
    }
    const delay = Math.max(
      this.expiresAtMs - Date.now() - PROACTIVE_REFRESH_LEAD_MS,
      MIN_REFRESH_DELAY_MS
    );
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.requestRefresh();
    }, delay);
  }

  private cancelProactiveRefresh(): void {
    if (this.refreshTimer === null) {
      return;
    }
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
}

function decodeExpiry(token: string): IExpiringJwtPayload {
  // Inline decode — we deliberately avoid `jwt-decode` here so this
  // file stays generic over provider claim shapes. The JWT body is
  // base64url; we only need `exp` and `iat`.
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('auth-session/malformed-token');
  }
  const body = parts[1] ?? '';
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const parsed = JSON.parse(decoded) as Partial<IExpiringJwtPayload>;
  if (typeof parsed.exp !== 'number' || typeof parsed.iat !== 'number') {
    throw new Error('auth-session/missing-exp');
  }
  return { exp: parsed.exp, iat: parsed.iat };
}

function parseStoredSession(raw: string): IStoredSession | null {
  // v1 layout: bare JWT string (no JSON envelope, Google-only). v2
  // layout: JSON envelope. Detect by leading character.
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<IStoredSession>;
      if (
        (parsed.provider === 'google' || parsed.provider === 'yandex') &&
        typeof parsed.token === 'string' &&
        parsed.token.length > 0
      ) {
        return { provider: parsed.provider, token: parsed.token };
      }
    } catch {
      return null;
    }
    return null;
  }
  // Legacy plain-string token — assume Google. Migrate at next persist.
  return { provider: 'google', token: trimmed };
}

function persistSession(value: IStoredSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota / private-mode failures are not actionable; the in-memory
    // token still works for the current page session.
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
