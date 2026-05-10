import { jwtDecode } from 'jwt-decode';
import type { IOidcProvider } from './IOidcProvider';
import type { IOidcProviderFactory } from './IOidcProviderFactory';
import type { IOidcProfile, IOidcSignInResult } from './types';

const PROMPT_TIMEOUT_MS = 10_000;
const FALLBACK_DISPLAY_NAME = 'Anonymous';

interface IGoogleIdTokenPayload {
  readonly sub: string;
  readonly name?: string;
  readonly email?: string;
  readonly picture?: string;
}

/**
 * `IOidcProvider` adapter around Google Identity Services (loaded by
 * `<GoogleOAuthProvider>`). Sign-in uses the explicit GIS button
 * rendered by `<GoogleLogin>` — this class doesn't draw UI; it just
 * exposes the silent-refresh + profile-decode surface so the rest of
 * the app sees Google through the same shape as Yandex.
 *
 * The signed-in callback path stays in `<SignInGate>` — when the GIS
 * button fires `onSuccess(credentialResponse)`, the gate calls
 * `provider.completeSignIn(credentialResponse.credential)` to feed the
 * issued token into the session. We avoid driving the popup from this
 * class because GIS button usage is mandated by Google's brand
 * guidelines.
 */
export class GoogleOidcProvider implements IOidcProvider {
  public readonly id = 'google' as const;
  public readonly displayName = 'Google';

  public constructor(private readonly clientId: string) {}

  /**
   * The Google sign-in flow is owned by `<GoogleLogin>`, not by this
   * class. We expose the method so the `IOidcProvider` shape is
   * complete; the gate uses `completeSignIn` instead.
   */
  public signIn(): Promise<IOidcSignInResult | null> {
    return Promise.resolve(null);
  }

  /**
   * Adopt a credential string handed to us by `<GoogleLogin>`'s
   * `onSuccess` callback. Returns the parsed sign-in result or `null`
   * when the credential is malformed.
   */
  public completeSignIn(credential: string): IOidcSignInResult | null {
    try {
      const profile = this.decodeProfile(credential);
      return { token: credential, profile };
    } catch {
      return null;
    }
  }

  public silentRefresh(loginHint?: string): Promise<IOidcSignInResult | null> {
    if (this.clientId.trim().length === 0) {
      return Promise.resolve(null);
    }
    const accountsId = window.google?.accounts?.id;
    if (accountsId === undefined) {
      return Promise.resolve(null);
    }

    return new Promise<IOidcSignInResult | null>(resolve => {
      let isSettled = false;
      const settle = (value: IOidcSignInResult | null): void => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        try {
          accountsId.cancel();
        } catch {
          // `cancel()` throws when no prompt is active; safe to ignore.
        }
        resolve(value);
      };

      const timeoutHandle = setTimeout(() => settle(null), PROMPT_TIMEOUT_MS);

      accountsId.initialize({
        client_id: this.clientId,
        auto_select: true,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
        login_hint: loginHint,
        callback: response => {
          clearTimeout(timeoutHandle);
          if (typeof response.credential === 'string' && response.credential.length > 0) {
            const result = this.completeSignIn(response.credential);
            settle(result);
          } else {
            settle(null);
          }
        },
      });

      accountsId.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          clearTimeout(timeoutHandle);
          settle(null);
        }
      });
    });
  }

  public decodeProfile(token: string): IOidcProfile {
    const payload = jwtDecode<IGoogleIdTokenPayload>(token);
    return {
      userId: `google:${payload.sub}`,
      name: payload.name ?? FALLBACK_DISPLAY_NAME,
      email: payload.email,
      pictureUrl: payload.picture,
    };
  }
}

/**
 * Factory entry consumed by `oidc-provider-registry.ts`. Lives next to
 * its provider so a third provider only ever touches its own folder.
 */
export const googleOidcProviderFactory: IOidcProviderFactory = {
  id: 'google',
  isConfigured: env => env.googleClientId.trim().length > 0,
  build: env => new GoogleOidcProvider(env.googleClientId),
};
