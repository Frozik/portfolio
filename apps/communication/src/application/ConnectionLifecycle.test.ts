import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthErrorCode, TokenClaims } from '../domain/Identity';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type { Milliseconds, UserId } from '../domain/types';
import { ConnectionLifecycle } from './ConnectionLifecycle';
import type { IAuditLogger } from './ports/IAuditLogger';
import type { IServerLogger } from './ports/IServerLogger';
import type { Result } from './Result';
import { err, ok } from './Result';

const GOOGLE_CLIENT_ID = 'google-client-id-1234.apps.googleusercontent.com';
const GOOGLE_ISSUER = 'https://accounts.google.com';
const VALID_ROOM_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as UserId;

function makeClaims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  return {
    sub: USER_ID,
    aud: GOOGLE_CLIENT_ID,
    iss: GOOGLE_ISSUER,
    iat: 1_700_000_000_000 as Milliseconds,
    exp: 1_700_003_600_000 as Milliseconds,
    name: 'Alice',
    ...overrides,
  };
}

function makeVerifier(next: () => Promise<Result<TokenClaims, AuthErrorCode>>): IIdentityVerifier {
  return {
    async verify() {
      return next();
    },
  };
}

function makeLogger(): IServerLogger {
  const noop = (): void => undefined;
  const logger: IServerLogger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => logger,
  };
  return logger;
}

function makeAudit(): IAuditLogger {
  return { audit: () => undefined };
}

describe('ConnectionLifecycle.onHandshake', () => {
  let lifecycle: ConnectionLifecycle;
  let verifyResult: Result<TokenClaims, AuthErrorCode>;

  beforeEach(() => {
    verifyResult = ok(makeClaims());
    lifecycle = new ConnectionLifecycle({
      verifier: makeVerifier(async () => verifyResult),
      googleClientId: GOOGLE_CLIENT_ID,
      googleIssuers: [GOOGLE_ISSUER],
      audit: makeAudit(),
      logger: makeLogger(),
      roomAllowlist: [],
    });
  });

  it('returns identity on happy path', async () => {
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity.userId).toBe(USER_ID);
      expect(result.value.identity.displayName).toBe('Alice');
      expect(result.value.socketId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });

  it('rejects missing-fields when handshake payload fails parsing', async () => {
    const result = await lifecycle.onHandshake({
      roomId: 'not-a-uuid',
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/missing-fields');
    }
  });

  it('forwards verifier-rejection codes', async () => {
    verifyResult = err('auth/expired-token');
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/expired-token');
    }
  });

  it('rejects wrong audience', async () => {
    verifyResult = ok(makeClaims({ aud: 'someone-else' }));
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-audience');
    }
  });

  it('rejects when azp does not match the client id', async () => {
    verifyResult = ok(makeClaims({ azp: 'different-azp' }));
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-audience');
    }
  });

  it('rejects wrong issuer', async () => {
    verifyResult = ok(makeClaims({ iss: 'https://evil.example' }));
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-issuer');
    }
  });

  it('rejects missing-name-claim when name is absent (no email cascade)', async () => {
    verifyResult = ok(makeClaims({ name: undefined, email: 'alice@example.com' }));
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/missing-name-claim');
    }
  });

  it('rejects with forbidden-room when allowlist excludes the user', async () => {
    const restricted = new ConnectionLifecycle({
      verifier: makeVerifier(async () => ok(makeClaims())),
      googleClientId: GOOGLE_CLIENT_ID,
      googleIssuers: [GOOGLE_ISSUER],
      audit: makeAudit(),
      logger: makeLogger(),
      roomAllowlist: [{ roomId: VALID_ROOM_ID, userIds: ['some-other-user'] }],
    });
    const result = await restricted.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/forbidden-room');
    }
  });

  it('admits a listed user when allowlist contains their userId', async () => {
    const restricted = new ConnectionLifecycle({
      verifier: makeVerifier(async () => ok(makeClaims())),
      googleClientId: GOOGLE_CLIENT_ID,
      googleIssuers: [GOOGLE_ISSUER],
      audit: makeAudit(),
      logger: makeLogger(),
      roomAllowlist: [{ roomId: VALID_ROOM_ID, userIds: [USER_ID] }],
    });
    const result = await restricted.onHandshake({
      roomId: VALID_ROOM_ID,
      idToken: 'jwt',
    });
    expect(result.ok).toBe(true);
  });
});

describe('ConnectionLifecycle.onRefresh', () => {
  let lifecycle: ConnectionLifecycle;
  let verifyResult: Result<TokenClaims, AuthErrorCode>;

  beforeEach(() => {
    verifyResult = ok(makeClaims({ iat: 1_700_001_000_000 as Milliseconds }));
    lifecycle = new ConnectionLifecycle({
      verifier: makeVerifier(async () => verifyResult),
      googleClientId: GOOGLE_CLIENT_ID,
      googleIssuers: [GOOGLE_ISSUER],
      audit: makeAudit(),
      logger: makeLogger(),
      roomAllowlist: [],
    });
  });

  it('accepts a fresher token from the same user', async () => {
    const current = makeClaims({ iat: 1_700_000_000_000 as Milliseconds });
    const result = await lifecycle.onRefresh(current, 'new-jwt');
    expect(result.ok).toBe(true);
  });

  it('rejects when sub differs', async () => {
    const current = makeClaims({ sub: 'other-user' as UserId });
    const result = await lifecycle.onRefresh(current, 'new-jwt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/sub-mismatch');
    }
  });

  it('rejects when iat is not monotonically increasing', async () => {
    verifyResult = ok(makeClaims({ iat: 1_700_000_000_000 as Milliseconds }));
    const current = makeClaims({ iat: 1_700_000_000_000 as Milliseconds });
    const result = await lifecycle.onRefresh(current, 'new-jwt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/invalid-token');
    }
  });

  it('rejects when sid changes between current and new claims', async () => {
    verifyResult = ok(makeClaims({ iat: 1_700_001_000_000 as Milliseconds, sid: 'session-2' }));
    const current = makeClaims({
      iat: 1_700_000_000_000 as Milliseconds,
      sid: 'session-1',
    });
    const result = await lifecycle.onRefresh(current, 'new-jwt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/invalid-token');
    }
  });
});
