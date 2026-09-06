import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import type { IServerConfig } from '../../application/config/server-config-schema';
import type { IVerifierHealth } from '../../application/ports/IVerifierHealth';
import type { IIdentityVerifier } from '../../domain/IIdentityVerifier';
import { VERIFIER_FACTORIES } from '../../infrastructure/verifier-registry';

type IdentityVerifier = IIdentityVerifier & Partial<IVerifierHealth>;
export type IdentityVerifierMap = ReadonlyMap<TIdentityProvider, IdentityVerifier>;
export type IdentityVerifierOverrides = Partial<Record<TIdentityProvider, IdentityVerifier>>;

/** What `/health` reports when no verifier can say anything about JWKS fetches. */
const NO_JWKS_HEALTH: IVerifierHealth = {
  getJwksFetchHealth: () => ({
    lastSuccessAtMs: null,
    lastFailureAtMs: null,
    consecutiveFailures: 0,
  }),
};

/**
 * The provider → verifier map from the registered factories. Each factory
 * decides whether its provider has the config it needs (Google requires the
 * OAuth client id; Yandex both client id and secret). Test overrides win
 * unconditionally, so an integration test can stub a verifier without also
 * satisfying its real config requirements.
 */
export function buildIdentityVerifiers(
  auth: IServerConfig['auth'],
  overrides: IdentityVerifierOverrides
): IdentityVerifierMap {
  const verifiers = new Map<TIdentityProvider, IdentityVerifier>();
  for (const factory of VERIFIER_FACTORIES) {
    const override = overrides[factory.id];
    if (override !== undefined) {
      verifiers.set(factory.id, override);
    } else if (factory.isConfigured(auth)) {
      verifiers.set(factory.id, factory.build(auth));
    }
  }
  return verifiers;
}

function isVerifierHealth(value: object): value is IVerifierHealth {
  return typeof (value as { getJwksFetchHealth?: unknown }).getJwksFetchHealth === 'function';
}

/**
 * The first registered verifier that exposes JWKS-fetch health, for the public
 * `/health` endpoint. In practice that is Google (Yandex is HS256-symmetric —
 * its health is dummy stats, fine to surface). Falls back to a stub when no
 * verifier is registered (development with no providers configured).
 */
export function pickVerifierHealth(verifiers: IdentityVerifierMap): IVerifierHealth {
  for (const verifier of verifiers.values()) {
    if (isVerifierHealth(verifier)) {
      return verifier;
    }
  }
  return NO_JWKS_HEALTH;
}
