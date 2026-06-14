/**
 * OIDC providers the communication server understands. Single source of truth
 * shared by the server's verifier registry and the frontend's sign-in
 * registry — adding a provider is one line here.
 */
export const IDENTITY_PROVIDERS = ['google', 'yandex'] as const;

export type TIdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export function isIdentityProvider(value: unknown): value is TIdentityProvider {
  return typeof value === 'string' && (IDENTITY_PROVIDERS as ReadonlyArray<string>).includes(value);
}
