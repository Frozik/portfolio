import { requireNativeModule } from 'expo';

/** What Android answered: a token, a consent still to give, or why not. */
export type TAuthorization =
  | {
      readonly kind: 'authorized';
      readonly token: string;
      /** The account the user chose, when Google says it. */
      readonly account: string | null;
      readonly grantedScopes: readonly string[];
    }
  | { readonly kind: 'needs-consent' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly code: number | null; readonly message: string | null };

interface IGoogleAuthorizationModule {
  authorize(
    scopes: readonly string[],
    account: string | null,
    interactive: boolean,
    chooseAccount: boolean
  ): Promise<TAuthorization>;
  clearToken(token: string): Promise<boolean>;
  revoke(scopes: readonly string[], account: string): Promise<boolean>;
}

/** The native module, typed: only this library's adapters import it. */
export const GOOGLE_AUTHORIZATION =
  requireNativeModule<IGoogleAuthorizationModule>('GoogleAuthorization');
