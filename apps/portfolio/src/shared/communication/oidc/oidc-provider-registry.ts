import { googleOidcProviderFactory } from './GoogleOidcProvider';
import type { IOidcProviderFactory } from './IOidcProviderFactory';
import { yandexOidcProviderFactory } from './YandexOidcProvider';

/**
 * Ordered list of every browser-side OIDC provider the app can wire up.
 * `<CommunicationProvider>` iterates this array and only includes a
 * provider when its factory's `isConfigured(env)` returns `true`
 * (typically driven by a `VITE_*_CLIENT_ID` env var being non-empty).
 *
 * The order here drives the order of sign-in buttons rendered by
 * `<SignInGate>` — Google first, then Yandex.
 */
export const OIDC_PROVIDER_FACTORIES: ReadonlyArray<IOidcProviderFactory> = [
  googleOidcProviderFactory,
  yandexOidcProviderFactory,
];
