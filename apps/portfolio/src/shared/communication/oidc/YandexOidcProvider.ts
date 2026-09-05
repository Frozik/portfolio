import { jwtDecode } from 'jwt-decode';
import type { IOidcProvider } from './IOidcProvider';
import type { IOidcProviderFactory } from './IOidcProviderFactory';
import type { IOidcProfile, IOidcSignInResult } from './types';

const YANDEX_AUTHORIZE_URL = 'https://oauth.yandex.com/authorize';
const YANDEX_INFO_JWT_URL = 'https://login.yandex.ru/info?format=jwt';
const YANDEX_OAUTH_MESSAGE_TYPE = 'yandex-oauth-callback';
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const POPUP_POLL_INTERVAL_MS = 250;
/**
 * Cap on how long we'll wait for the user to complete the Yandex
 * popup before giving up and resolving `null`. Long enough for a
 * fresh Yandex login + 2FA, short enough that an abandoned popup
 * doesn't pin the AuthSession promise indefinitely.
 */
const POPUP_TIMEOUT_MS = 5 * 60 * 1_000;
const FALLBACK_DISPLAY_NAME = 'Anonymous';

interface IYandexInfoJwtPayload {
  readonly uid?: number | string;
  readonly login?: string;
  readonly name?: string;
  readonly display_name?: string;
  readonly email?: string;
  readonly default_email?: string;
  /**
   * Yandex avatar id. Only populated when the OAuth app has the
   * "Access to user's avatar" permission enabled. In JWT payloads
   * the field is `avatar_id` (not `default_avatar_id` like the JSON
   * `/info` response). When absent or when `is_avatar_empty` is true,
   * the user has no real avatar and we fall back to initials.
   */
  readonly avatar_id?: string;
  readonly is_avatar_empty?: boolean;
}

/**
 * Size keyword from the Yandex avatar URL convention. 100×100 retina
 * gives crisp 50px rendering on standard displays — matches the sizes
 * used in our retro avatars + AccountChip.
 *
 * https://yandex.com/dev/id/doc/en/user-information
 */
const YANDEX_AVATAR_SIZE = 'islands-retina-50';

interface IYandexCallbackMessage {
  readonly type: typeof YANDEX_OAUTH_MESSAGE_TYPE;
  readonly accessToken: string;
  readonly state: string;
  readonly error?: string;
}

interface IYandexOidcProviderParams {
  readonly clientId: string;
  /**
   * Origin used to build the popup `redirect_uri`. Defaults to
   * `window.location.origin`. Tests inject a fixed value.
   */
  readonly redirectOrigin?: string;
  /**
   * Path under the configured base URL that hosts the static OAuth
   * callback page (`apps/portfolio/public/oauth/yandex/callback.html`).
   * Defaults to `/portfolio/oauth/yandex/callback` to match the SPA
   * `BASE_URL`. The matching value MUST be registered as a permitted
   * Redirect URI on the Yandex OAuth application page.
   */
  readonly callbackPath?: string;
}

/**
 * Path under the SPA base URL that hosts the OAuth callback. Resolves
 * to the React route `<YandexOauthCallbackPage>` — VitePWA's
 * `navigateFallback` returns the SPA bundle for this path, React
 * Router matches the component, and the component runs the
 * postMessage + close dance.
 *
 * The Yandex OAuth Console must list this exact path for every origin
 * the app can be served from (localhost dev / preview / production
 * GitHub Pages).
 */
const DEFAULT_CALLBACK_PATH = '/portfolio/oauth/yandex/callback';

/**
 * `IOidcProvider` for Yandex OAuth → JWT. Sign-in opens a popup at
 * `oauth.yandex.com/authorize` (implicit flow), receives the access
 * token via `postMessage` from a tiny static callback page, then
 * exchanges the access token for a signed JWT via
 * `https://login.yandex.ru/info?format=jwt`. The JWT is HS256-signed
 * with the application's `client_secret`, so verification happens
 * server-side.
 *
 * Silent refresh re-runs only the second leg — the OAuth access token
 * is long-lived (Yandex defaults to one year), so as long as we have
 * one cached, we can mint a fresh JWT without any popup or user
 * interaction. When the access token expires the call returns `null`
 * and the gate falls back to the explicit sign-in button.
 */
class YandexOidcProvider implements IOidcProvider {
  public readonly id = 'yandex' as const;
  public readonly displayName = 'Яндекс';

  private readonly clientId: string;
  private readonly redirectUri: string;

  public constructor(params: IYandexOidcProviderParams) {
    this.clientId = params.clientId;
    const origin = params.redirectOrigin ?? window.location.origin;
    const path = params.callbackPath ?? DEFAULT_CALLBACK_PATH;
    this.redirectUri = `${origin}${path}`;
  }

  public async signIn(): Promise<IOidcSignInResult | null> {
    if (this.clientId.trim().length === 0) {
      return null;
    }
    const accessToken = await this.openOAuthPopup();
    if (accessToken === null) {
      return null;
    }
    return this.exchangeAccessTokenForJwt(accessToken);
  }

  public async silentRefresh(): Promise<IOidcSignInResult | null> {
    const cachedAccessToken = readCachedAccessToken();
    if (cachedAccessToken === null) {
      return null;
    }
    return this.exchangeAccessTokenForJwt(cachedAccessToken);
  }

  public decodeProfile(token: string): IOidcProfile {
    const payload = jwtDecode<IYandexInfoJwtPayload>(token);
    return mapPayloadToProfile(payload);
  }

  public signOut(): void {
    clearCachedAccessToken();
  }

  private openOAuthPopup(): Promise<string | null> {
    return new Promise<string | null>(resolve => {
      const state = crypto.randomUUID();
      const url = new URL(YANDEX_AUTHORIZE_URL);
      url.searchParams.set('response_type', 'token');
      url.searchParams.set('client_id', this.clientId);
      url.searchParams.set('redirect_uri', this.redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('force_confirm', 'yes');

      const popupFeatures = computePopupFeatures();
      const popup = window.open(url.toString(), 'yandex-oauth', popupFeatures);
      if (popup === null) {
        // Browser blocked the popup (no user gesture). Surface as
        // dismissal — caller can re-render the sign-in button.
        resolve(null);
        return;
      }

      let isSettled = false;
      const settle = (value: string | null): void => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        window.removeEventListener('message', handleMessage);
        clearInterval(pollHandle);
        clearTimeout(timeoutHandle);
        try {
          popup.close();
        } catch {
          // Closing an already-closed popup throws on some browsers.
        }
        resolve(value);
      };

      const handleMessage = (event: MessageEvent<unknown>): void => {
        if (event.origin !== window.location.origin) {
          return;
        }
        const data = event.data as Partial<IYandexCallbackMessage> | undefined;
        if (data === undefined || data.type !== YANDEX_OAUTH_MESSAGE_TYPE) {
          return;
        }
        if (typeof data.state !== 'string' || data.state !== state) {
          // CSRF guard — drop messages whose state doesn't match the
          // popup we opened.
          return;
        }
        if (typeof data.error === 'string' && data.error.length > 0) {
          settle(null);
          return;
        }
        if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
          settle(null);
          return;
        }
        settle(data.accessToken);
      };

      const pollHandle = setInterval(() => {
        if (popup.closed) {
          settle(null);
        }
      }, POPUP_POLL_INTERVAL_MS);

      const timeoutHandle = setTimeout(() => settle(null), POPUP_TIMEOUT_MS);

      window.addEventListener('message', handleMessage);
    });
  }

  private async exchangeAccessTokenForJwt(accessToken: string): Promise<IOidcSignInResult | null> {
    let jwtBody: string;
    try {
      const response = await fetch(YANDEX_INFO_JWT_URL, {
        method: 'GET',
        headers: { Authorization: `OAuth ${accessToken}` },
      });
      if (!response.ok) {
        clearCachedAccessToken();
        return null;
      }
      jwtBody = (await response.text()).trim();
    } catch {
      return null;
    }
    if (jwtBody.length === 0) {
      return null;
    }
    let profile: IOidcProfile;
    try {
      profile = this.decodeProfile(jwtBody);
    } catch {
      return null;
    }
    writeCachedAccessToken(accessToken);
    return {
      token: jwtBody,
      profile,
      accessToken,
    };
  }
}

const ACCESS_TOKEN_STORAGE_KEY = 'communication.auth.yandex.accessToken';

function readCachedAccessToken(): string | null {
  try {
    const raw = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function writeCachedAccessToken(value: string): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
  } catch {
    // Quota / private-mode failure — silent refresh just won't be
    // able to find the token next time, that's the only consequence.
  }
}

function clearCachedAccessToken(): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Same rationale as writeCachedAccessToken.
  }
}

function mapPayloadToProfile(payload: IYandexInfoJwtPayload): IOidcProfile {
  const rawUid = payload.uid;
  if (rawUid === undefined || rawUid === null) {
    throw new Error('yandex/missing-uid');
  }
  const subString = typeof rawUid === 'number' ? String(rawUid) : rawUid;
  const name =
    firstNonEmpty(payload.display_name) ??
    firstNonEmpty(payload.name) ??
    firstNonEmpty(payload.login) ??
    FALLBACK_DISPLAY_NAME;
  const email = firstNonEmpty(payload.default_email) ?? firstNonEmpty(payload.email);
  const avatarId = firstNonEmpty(payload.avatar_id);
  const pictureUrl =
    avatarId !== undefined && payload.is_avatar_empty !== true
      ? `https://avatars.yandex.net/get-yapic/${avatarId}/${YANDEX_AVATAR_SIZE}`
      : undefined;
  return {
    userId: `yandex:${subString}`,
    name,
    email,
    pictureUrl,
  };
}

function firstNonEmpty(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : value;
}

function computePopupFeatures(): string {
  const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2));
  return `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`;
}
export const YANDEX_OAUTH_MESSAGE = YANDEX_OAUTH_MESSAGE_TYPE;

/**
 * Factory entry consumed by `oidc-provider-registry.ts`. Yandex needs
 * only the public client_id on the browser; the matching client_secret
 * lives server-side and is never exposed.
 */
export const yandexOidcProviderFactory: IOidcProviderFactory = {
  id: 'yandex',
  isConfigured: env => env.yandexClientId.trim().length > 0,
  build: env => new YandexOidcProvider({ clientId: env.yandexClientId }),
};
