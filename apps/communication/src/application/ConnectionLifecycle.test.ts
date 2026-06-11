import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthErrorCode, TokenClaims } from '../domain/Identity';
import type { TIdentityProvider } from '../domain/IdentityProvider';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type { Milliseconds, UserId } from '../domain/types';
import { ConnectionLifecycle } from './ConnectionLifecycle';
import type { IAuditLogger } from './ports/IAuditLogger';
import type { IServerLogger } from './ports/IServerLogger';
import type { Result } from './Result';
import { err, ok } from './Result';

const VALID_ROOM_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = 'google:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as UserId;

function makeClaims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  return {
    sub: USER_ID,
    provider: 'google',
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

function singleVerifierMap(
  verifier: IIdentityVerifier
): ReadonlyMap<TIdentityProvider, IIdentityVerifier> {
  return new Map([['google', verifier]]);
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
      verifiers: singleVerifierMap(makeVerifier(async () => verifyResult)),
      audit: makeAudit(),
      logger: makeLogger(),
    });
  });

  it('returns identity on happy path', async () => {
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      provider: 'google',
      token: 'jwt',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity.userId).toBe(USER_ID);
      expect(result.value.identity.displayName).toBe('Alice');
      expect(result.value.claims).not.toBeNull();
      expect(result.value.claims?.provider).toBe('google');
    }
  });

  it('returns anonymous identity when no provider/token is presented', async () => {
    const result = await lifecycle.onHandshake({ roomId: VALID_ROOM_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity.userId.startsWith('anon:')).toBe(true);
      expect(result.value.identity.displayName).toBe('Guest');
      expect(result.value.claims).toBeNull();
    }
  });

  it('rejects missing-fields when handshake payload fails parsing', async () => {
    const result = await lifecycle.onHandshake({
      roomId: 'not-a-uuid',
      provider: 'google',
      token: 'jwt',
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
      provider: 'google',
      token: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/expired-token');
    }
  });

  it('rejects with invalid-token when the requested provider has no registered verifier', async () => {
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      provider: 'yandex',
      token: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/invalid-token');
    }
  });

  it('rejects missing-name-claim when name is absent (no email cascade)', async () => {
    verifyResult = ok(makeClaims({ name: undefined, email: 'alice@example.com' }));
    const result = await lifecycle.onHandshake({
      roomId: VALID_ROOM_ID,
      provider: 'google',
      token: 'jwt',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/missing-name-claim');
    }
  });

  it('routes Yandex handshakes to the Yandex verifier', async () => {
    const verifiers = new Map<TIdentityProvider, IIdentityVerifier>([
      [
        'google',
        makeVerifier(async () => err('auth/invalid-token')), // would fail if invoked
      ],
      [
        'yandex',
        makeVerifier(async () =>
          ok(
            makeClaims({
              sub: 'yandex:1234' as UserId,
              provider: 'yandex',
              name: 'Иван',
            })
          )
        ),
      ],
    ]);
    const router = new ConnectionLifecycle({
      verifiers,
      audit: makeAudit(),
      logger: makeLogger(),
    });
    const result = await router.onHandshake({
      roomId: VALID_ROOM_ID,
      provider: 'yandex',
      token: 'yandex-jwt',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.identity.userId).toBe('yandex:1234');
      expect(result.value.claims?.provider).toBe('yandex');
    }
  });
});

describe('ConnectionLifecycle.onRefresh', () => {
  let lifecycle: ConnectionLifecycle;
  let verifyResult: Result<TokenClaims, AuthErrorCode>;

  beforeEach(() => {
    verifyResult = ok(makeClaims({ iat: 1_700_001_000_000 as Milliseconds }));
    lifecycle = new ConnectionLifecycle({
      verifiers: singleVerifierMap(makeVerifier(async () => verifyResult)),
      audit: makeAudit(),
      logger: makeLogger(),
    });
  });

  it('accepts a fresher token from the same user', async () => {
    const current = makeClaims({ iat: 1_700_000_000_000 as Milliseconds });
    const result = await lifecycle.onRefresh(current, 'new-jwt');
    expect(result.ok).toBe(true);
  });

  it('rejects when sub differs', async () => {
    const current = makeClaims({ sub: 'google:other-user' as UserId });
    const result = await lifecycle.onRefresh(current, 'new-jwt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/sub-mismatch');
    }
  });

  it('rejects when provider switches between sessions', async () => {
    verifyResult = ok(
      makeClaims({
        sub: USER_ID,
        provider: 'yandex',
        iat: 1_700_001_000_000 as Milliseconds,
      })
    );
    const current = makeClaims({ provider: 'google' });
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
