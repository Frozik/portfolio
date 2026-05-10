import { googleVerifierFactory } from './GoogleIdentityVerifier';
import type { IVerifierFactory } from './IVerifierFactory';
import { yandexVerifierFactory } from './YandexIdentityVerifier';

/**
 * Ordered list of every verifier the server can register. Bootstrap
 * iterates this array; an entry stays out of the active verifier map
 * when its `isConfigured(auth)` returns `false`.
 *
 * Adding a new provider:
 *  1. Append it to `IDENTITY_PROVIDERS` in `domain/IdentityProvider.ts`.
 *  2. Drop a `*IdentityVerifier.ts` next to the existing two and
 *     export a factory.
 *  3. Add the factory to this array.
 *
 * Nothing else should need to change in the bootstrap or routing
 * layers — the rest of the server treats verifiers uniformly via
 * `IIdentityVerifier`.
 */
export const VERIFIER_FACTORIES: ReadonlyArray<IVerifierFactory> = [
  googleVerifierFactory,
  yandexVerifierFactory,
];
