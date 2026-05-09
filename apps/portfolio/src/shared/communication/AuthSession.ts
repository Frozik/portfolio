import { jwtDecode } from 'jwt-decode';
import { isNil } from 'lodash-es';
import { makeAutoObservable, runInAction } from 'mobx';

/**
 * Subset of the Google ID-token JWT claims relevant to the
 * communication session. The server validates the full token; the
 * browser only consumes a few fields to render UI and schedule a
 * proactive refresh.
 */
interface IGoogleIdTokenPayload {
  readonly sub: string;
  readonly name?: string;
  readonly email?: string;
  readonly picture?: string;
  /** Unix epoch seconds. */
  readonly exp: number;
  /** Unix epoch seconds. */
  readonly iat: number;
}

export interface IProfileSnapshot {
  readonly userId: string;
  readonly name: string;
  readonly email?: string;
  readonly pictureUrl?: string;
}

/**
 * Storage key used to persist the active ID token across page
 * reloads. `sessionStorage` (not `localStorage`) so a tab close
 * fully signs the user out — matches the public-facing portfolio
 * threat model.
 */
const STORAGE_KEY = 'communication.auth.idToken';

const SECONDS_TO_MS = 1_000;

const FALLBACK_DISPLAY_NAME = 'Anonymous';

/**
 * Schedule a proactive silent refresh this many milliseconds before
 * the JWT `exp`. Wide enough that a slow GIS round-trip (FedCM
 * dialog, network blip) still completes before the server emits
 * `auth:token-expiring`, which itself fires a few seconds before the
 * actual expiry.
 */
const PROACTIVE_REFRESH_LEAD_MS = 60_000;

/** Lower bound on the proactive refresh delay — never schedule for the past. */
const MIN_REFRESH_DELAY_MS = 1_000;

type TRefreshHandler = () => Promise<string | null>;

/**
 * Browser-side auth state for the new `apps/communication` server.
 *
 * The session owns:
 *  - The most recently issued Google ID token.
 *  - A decoded snapshot of the JWT claims (read-only profile).
 *  - The `expiresAtMs` derived from the JWT `exp` claim, used by
 *    the React provider layer to surface "refresh needed" hints.
 *
 * Token persistence uses `sessionStorage`; the model is a public
 * portfolio so a longer-lived `localStorage` token is unnecessary
 * risk surface.
 */
export class AuthSession {
  public idToken: string | null = null;
  public profile: IProfileSnapshot | null = null;
  public expiresAtMs: number | null = null;

  /**
   * Refresh handler installed by `<CommunicationProvider>` once the
   * Google Identity Services script is loaded. The session calls it
   * proactively shortly before `expiresAtMs` and on demand from the
   * communication client when the server emits `auth:token-expiring`.
   * Returns the next ID token string, or `null` when GIS could not
   * issue one silently.
   */
  private refreshHandler: TRefreshHandler | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Coalesces concurrent refresh requests. The server-driven and the
   * proactive timer paths both call `requestRefresh()`; without
   * coalescing they would fire two parallel GIS prompts and the
   * second would always race-lose.
   */
  private inFlightRefresh: Promise<string | null> | null = null;

  public constructor() {
    makeAutoObservable(
      this,
      {
        // Internal lifecycle plumbing — not observable UI state. Marking
        // these non-observable lets us assign them outside `runInAction`
        // without tripping MobX strict-mode warnings.
        refreshHandler: false,
        refreshTimer: false,
        inFlightRefresh: false,
      } as never,
      { autoBind: true }
    );
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!isNil(stored)) {
      this.setIdToken(stored);
    }
  }

  public get isSignedIn(): boolean {
    return this.idToken !== null && this.expiresAtMs !== null && this.expiresAtMs > Date.now();
  }

  /**
   * Install the silent-refresh handler. Called once by the provider
   * after the GIS script loads. The session does NOT own the handler
   * — it just borrows it for the lifetime of the React tree, hence
   * the matching `clearRefreshHandler()` for symmetric cleanup.
   */
  public setRefreshHandler(handler: TRefreshHandler): void {
    this.refreshHandler = handler;
    this.scheduleProactiveRefresh();
  }

  public clearRefreshHandler(): void {
    this.refreshHandler = null;
    this.cancelProactiveRefresh();
  }

  /**
   * On-demand silent refresh. Used by `CommunicationClient` when the
   * server emits `auth:token-expiring`, and internally by the
   * proactive timer. Returns the new token (string) or `null` when
   * no handler is installed or GIS declined to issue one.
   */
  public requestRefresh(): Promise<string | null> {
    if (this.inFlightRefresh !== null) {
      return this.inFlightRefresh;
    }
    if (this.refreshHandler === null) {
      return Promise.resolve(null);
    }
    const handler = this.refreshHandler;
    const promise = (async () => {
      let nextToken: string | null;
      try {
        nextToken = await handler();
      } catch {
        nextToken = null;
      }
      if (nextToken !== null && nextToken.length > 0) {
        this.setIdToken(nextToken);
      }
      return nextToken;
    })().finally(() => {
      this.inFlightRefresh = null;
    });
    this.inFlightRefresh = promise;
    return promise;
  }

  /**
   * Adopt a freshly issued Google ID token. The JWT is decoded to
   * populate `profile` and `expiresAtMs`. A malformed token is
   * treated as a sign-out — the previous session is cleared rather
   * than silently kept around.
   */
  public setIdToken(token: string): void {
    let payload: IGoogleIdTokenPayload;
    try {
      payload = jwtDecode<IGoogleIdTokenPayload>(token);
    } catch {
      this.signOut();
      return;
    }
    runInAction(() => {
      this.idToken = token;
      this.expiresAtMs = payload.exp * SECONDS_TO_MS;
      this.profile = {
        userId: payload.sub,
        name: payload.name ?? FALLBACK_DISPLAY_NAME,
        email: payload.email,
        pictureUrl: payload.picture,
      };
    });
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Quota / private-mode failures are not actionable; the
      // in-memory token still works for the current page session.
    }
    this.scheduleProactiveRefresh();
  }

  public signOut(): void {
    runInAction(() => {
      this.idToken = null;
      this.profile = null;
      this.expiresAtMs = null;
    });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore — same reasoning as setIdToken.
    }
    this.cancelProactiveRefresh();
  }

  private scheduleProactiveRefresh(): void {
    this.cancelProactiveRefresh();
    if (this.refreshHandler === null || this.expiresAtMs === null) {
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
