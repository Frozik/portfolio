/**
 * Single source of truth for the OIDC providers the server understands.
 * Both the wire-protocol Zod enum and the verifier-registry derive from
 * this tuple — adding a new provider is one line here, then one entry
 * in `infrastructure/verifier-registry.ts`.
 *
 * Mirrored on the frontend in
 * `apps/portfolio/src/shared/communication/oidc/types.ts`.
 */
export const IDENTITY_PROVIDERS = ['google', 'yandex'] as const;

export type TIdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export function isIdentityProvider(value: unknown): value is TIdentityProvider {
  return typeof value === 'string' && (IDENTITY_PROVIDERS as ReadonlyArray<string>).includes(value);
}
