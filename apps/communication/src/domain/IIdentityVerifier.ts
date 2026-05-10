import type { Result } from '../application/Result';
import type { AuthErrorCode, TokenClaims } from './Identity';

export interface IIdentityVerifier {
  verify(token: string): Promise<Result<TokenClaims, AuthErrorCode>>;
}
