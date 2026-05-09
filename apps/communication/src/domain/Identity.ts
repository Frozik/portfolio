import type { DisplayName, Milliseconds, UserId } from './types';

export type Identity = {
  userId: UserId;
  displayName: DisplayName;
  socketId: string;
};

export type TokenClaims = {
  sub: UserId;
  exp: Milliseconds;
  iat: Milliseconds;
  iss: string;
  aud: string;
  name?: string;
  email?: string;
  sid?: string;
  azp?: string;
};

export type AuthErrorCode =
  | 'auth/invalid-token'
  | 'auth/expired-token'
  | 'auth/wrong-audience'
  | 'auth/wrong-issuer'
  | 'auth/missing-fields'
  | 'auth/jwks-unreachable'
  | 'auth/missing-name-claim'
  | 'auth/sub-mismatch'
  | 'auth/rate-limited'
  | 'auth/forbidden-room';
