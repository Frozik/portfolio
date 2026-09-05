import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import type { IOidcProvider } from './IOidcProvider';

/**
 * Browser-side env values consumed by every provider's factory. Kept
 * tiny so a new provider just claims its own field — the registry
 * never has to know per-provider config shapes.
 */
interface IOidcEnv {
  readonly googleClientId: string;
  readonly yandexClientId: string;
}

/**
 * Pluggable factory for one OIDC provider's client-side adapter.
 * Each provider's class file (`GoogleOidcProvider`, `YandexOidcProvider`,
 * ...) exports a `*OidcProviderFactory` value implementing this
 * interface; `oidc-provider-registry.ts` aggregates them into the array
 * `<CommunicationProvider>` iterates over.
 *
 * Adding a new provider:
 *  1. Append it to `IDENTITY_PROVIDERS` in
 *     `@frozik/communication-protocol/identity`.
 *  2. Drop a `*OidcProvider.ts` next to the existing two and export
 *     a factory.
 *  3. Add the factory to the registry array.
 *
 * No other touch point — the registry handles the rest.
 */
export interface IOidcProviderFactory {
  readonly id: TIdentityProvider;
  isConfigured(env: IOidcEnv): boolean;
  build(env: IOidcEnv): IOidcProvider;
}
