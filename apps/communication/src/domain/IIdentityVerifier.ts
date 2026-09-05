import type { AuthErrorCode, TokenClaims } from './Identity';
import type { Result } from './Result';

export interface IIdentityVerifier {
  verify(token: string): Promise<Result<TokenClaims, AuthErrorCode>>;
}
