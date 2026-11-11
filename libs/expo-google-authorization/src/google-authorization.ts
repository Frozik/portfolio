import type { IAccessTokenSource } from '@frozik/cloud-storage/google-drive/access-token';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { err, ok } from '@frozik/utils/result/result';

import type { TAuthorization } from './GoogleAuthorizationModule';
import { GOOGLE_AUTHORIZATION } from './GoogleAuthorizationModule';

/** Google Play services' status for «no network» (CommonStatusCodes.NETWORK_ERROR). */
export const NETWORK_ERROR = 7;

/**
 * Google authorization for some scopes with an account already on the phone. The token source
 * asks Android silently — Google caches and renews the token — and only `connect` shows the
 * account picker and the consent screen.
 */
export interface IGoogleAuthorization extends IAccessTokenSource {
  /** The system's account picker and consent screen; `chooseAccount` asks again even if one is set. */
  connect(chooseAccount: boolean): Promise<TAuthorization>;
  /** Takes the access back from the app, for the account it was given with. */
  disconnect(account: string): Promise<void>;
}

export function googleAuthorization({
  scopes,
  account,
}: {
  readonly scopes: readonly string[];
  /** The account chosen before, so a silent request does not have to ask which one. */
  readonly account: () => string | null;
}): IGoogleAuthorization {
  let lastToken: string | null = null;
  return {
    async token() {
      const answer = await GOOGLE_AUTHORIZATION.authorize(scopes, account(), false, false);
      switch (answer.kind) {
        case 'authorized':
          lastToken = answer.token;
          return ok(answer.token);
        case 'failed':
          return err(
            answer.code === NETWORK_ERROR ? { kind: 'offline' } : { kind: 'auth-required' }
          );
        case 'needs-consent':
        case 'cancelled':
          return err({ kind: 'auth-required' });
        default:
          return assertNever(answer);
      }
    },
    invalidate() {
      if (lastToken !== null) {
        void GOOGLE_AUTHORIZATION.clearToken(lastToken);
        lastToken = null;
      }
    },
    connect: chooseAccount =>
      GOOGLE_AUTHORIZATION.authorize(scopes, account(), true, chooseAccount),
    async disconnect(chosen) {
      await GOOGLE_AUTHORIZATION.revoke(scopes, chosen);
      lastToken = null;
    },
  };
}
