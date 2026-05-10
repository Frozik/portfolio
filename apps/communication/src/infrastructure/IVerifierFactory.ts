import type { AuthSection } from '../application/config/sections/auth-section';
import type { IVerifierHealth } from '../application/ports/IVerifierHealth';
import type { TIdentityProvider } from '../domain/IdentityProvider';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';

/**
 * Pluggable factory for one OIDC provider's verifier. Each verifier
 * lives next to its impl (`GoogleIdentityVerifier`, `YandexIdentityVerifier`,
 * ...) and exports a `*VerifierFactory` value implementing this
 * interface; `verifier-registry.ts` aggregates them into the array
 * the bootstrap iterates over. Adding a third provider = drop a new
 * entry into that array, no other touch points.
 */
export interface IVerifierFactory {
  readonly id: TIdentityProvider;
  /**
   * Whether the operator has supplied enough config to enable this
   * provider. Returning `false` means the verifier stays unregistered
   * — handshakes quoting this provider are rejected as
   * `auth/invalid-token`.
   */
  isConfigured(auth: AuthSection): boolean;
  /**
   * Build the verifier from the validated config slice. Only called
   * when `isConfigured(auth)` returned `true`.
   */
  build(auth: AuthSection): IIdentityVerifier & Partial<IVerifierHealth>;
}
