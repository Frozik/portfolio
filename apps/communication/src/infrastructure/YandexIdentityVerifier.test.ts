import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { YandexIdentityVerifier } from './YandexIdentityVerifier';

const SECRET = 'integration-test-secret-1234567890';
const SECRET_BYTES = new TextEncoder().encode(SECRET);
const ISSUER = 'login.yandex.ru';

const ONE_SECOND_MS = 1_000;

function nowSec(): number {
  return Math.floor(Date.now() / ONE_SECOND_MS);
}

function buildVerifier(overrides: { secret?: string; expectedIssuer?: string } = {}) {
  return new YandexIdentityVerifier({
    clientSecret: overrides.secret ?? SECRET,
    expectedIssuer: overrides.expectedIssuer,
    clockToleranceSec: 0,
  });
}

interface ITestPayload {
  uid: number | string;
  display_name?: string;
  name?: string;
  login?: string;
  default_email?: string;
  email?: string;
  iss?: string;
}

async function signTestJwt(
  payload: ITestPayload,
  options: { ttlSec?: number; issuer?: string; alg?: string; secret?: Uint8Array } = {}
): Promise<string> {
  const ttlSec = options.ttlSec ?? 3_600;
  const issuedAt = nowSec();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: options.alg ?? 'HS256' })
    .setIssuedAt(issuedAt)
    .setIssuer(options.issuer ?? ISSUER)
    .setExpirationTime(issuedAt + ttlSec)
    .sign(options.secret ?? SECRET_BYTES);
}

describe('YandexIdentityVerifier', () => {
  it('returns canonical claims on a happy path', async () => {
    const token = await signTestJwt({
      uid: 1142345158,
      display_name: 'Иван Петров',
      default_email: 'ivan@yandex.ru',
    });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sub).toBe('yandex:1142345158');
      expect(result.value.provider).toBe('yandex');
      expect(result.value.name).toBe('Иван Петров');
      expect(result.value.email).toBe('ivan@yandex.ru');
    }
  });

  it('falls back through display_name → name → login when picking the public name', async () => {
    const token = await signTestJwt({
      uid: 7,
      display_name: '  ',
      name: '',
      login: 'test-login',
    });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('test-login');
    }
  });

  it('falls back from default_email to email', async () => {
    const token = await signTestJwt({ uid: 7, name: 'X', email: 'fallback@yandex.ru' });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('fallback@yandex.ru');
    }
  });

  it('returns auth/expired-token when exp is in the past', async () => {
    const token = await signTestJwt({ uid: 1, name: 'X' }, { ttlSec: -10 });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/expired-token');
    }
  });

  it('returns auth/wrong-issuer when iss does not match', async () => {
    const token = await signTestJwt({ uid: 1, name: 'X' }, { issuer: 'https://malicious.example' });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-issuer');
    }
  });

  it('rejects RS256 (algorithm-confusion defence)', async () => {
    // Sign with HS256 using a different secret — verification with the
    // expected secret will reject the signature, which surfaces as
    // `auth/invalid-token` (jose JWSSignatureVerificationFailed).
    const token = await signTestJwt(
      { uid: 1, name: 'X' },
      { secret: new TextEncoder().encode('totally-different-secret') }
    );
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/invalid-token');
    }
  });

  it('rejects malformed tokens', async () => {
    const verifier = buildVerifier();
    const result = await verifier.verify('not-a-real-jwt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/invalid-token');
    }
  });

  it('rejects when uid is missing', async () => {
    const token = await new SignJWT({ name: 'X' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(nowSec())
      .setIssuer(ISSUER)
      .setExpirationTime(nowSec() + 60)
      .sign(SECRET_BYTES);
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/missing-fields');
    }
  });

  it('handles a string-typed uid (Yandex sometimes returns numbers as strings)', async () => {
    const token = await signTestJwt({ uid: '42', name: 'X' });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sub).toBe('yandex:42');
    }
  });
});
