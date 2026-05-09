// @vitest-environment node
import type { Server as HttpServer } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { JWK } from 'jose';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GoogleIdentityVerifier } from './GoogleIdentityVerifier';

const TEST_AUDIENCE = 'test-audience-123';
const TEST_ISSUER = 'https://accounts.google.com';
const TEST_KID = 'test-key-id-1';
const TEST_SUB = '550e8400-e29b-41d4-a716-446655440000';
const SHORT_TIMEOUT_MS = 200;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

type JwksFixture = {
  privateKey: CryptoKey;
  publicJwk: JWK;
  jwksJson: string;
};

async function createKeyFixture(): Promise<JwksFixture> {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const exportedPublic = await exportJWK(publicKey);
  exportedPublic.kid = TEST_KID;
  exportedPublic.alg = 'RS256';
  exportedPublic.use = 'sig';
  const jwksJson = JSON.stringify({ keys: [exportedPublic] });
  return { privateKey, publicJwk: exportedPublic, jwksJson };
}

type StartedServer = {
  url: URL;
  server: HttpServer;
  setHandler: (handler: (req: Parameters<Parameters<HttpServer['on']>[1]>[0]) => void) => void;
  setRespond: (respond: (path: string) => { status: number; body: string } | null) => void;
};

async function startJwksServer(initialBody: string): Promise<StartedServer> {
  let respond: (path: string) => { status: number; body: string } | null = path => {
    if (path === '/jwks') {
      return { status: 200, body: initialBody };
    }
    return null;
  };

  const server = createServer((req, res) => {
    const path = req.url ?? '';
    const result = respond(path);
    if (!result) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.statusCode = result.status;
    res.setHeader('content-type', 'application/json');
    res.end(result.body);
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  const url = new URL(`http://127.0.0.1:${address.port}/jwks`);
  return {
    url,
    server,
    setHandler: () => {
      // unused placeholder kept for symmetry
    },
    setRespond: next => {
      respond = next;
    },
  };
}

async function stopServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

async function signRs256(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  options: {
    audience?: string;
    issuer?: string;
    expiresIn?: string;
    issuedAt?: number;
  } = {}
): Promise<string> {
  const builder = new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: TEST_KID });
  if (options.issuedAt !== undefined) {
    builder.setIssuedAt(options.issuedAt);
  } else {
    builder.setIssuedAt();
  }
  builder.setSubject(TEST_SUB);
  builder.setIssuer(options.issuer ?? TEST_ISSUER);
  builder.setAudience(options.audience ?? TEST_AUDIENCE);
  builder.setExpirationTime(options.expiresIn ?? '5m');
  return builder.sign(privateKey);
}

describe('GoogleIdentityVerifier (integration)', () => {
  let fixture: JwksFixture;
  let started: StartedServer;

  beforeEach(async () => {
    fixture = await createKeyFixture();
    started = await startJwksServer(fixture.jwksJson);
  });

  afterEach(async () => {
    await stopServer(started.server);
  });

  function buildVerifier(
    overrides: Partial<{ fetchMaxAttempts: number }> = {}
  ): GoogleIdentityVerifier {
    return new GoogleIdentityVerifier({
      audience: TEST_AUDIENCE,
      issuers: [TEST_ISSUER, 'accounts.google.com'],
      jwksUrl: started.url,
      clockToleranceSec: 0,
      fetchMaxAttempts: overrides.fetchMaxAttempts ?? 1,
      fetchTimeoutMs: SHORT_TIMEOUT_MS,
    });
  }

  it('returns claims for a valid signed token', async () => {
    const token = await signRs256({ name: 'Alice', email: 'a@example.com' }, fixture.privateKey);
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sub).toBe(TEST_SUB);
      expect(result.value.aud).toBe(TEST_AUDIENCE);
      expect(result.value.iss).toBe(TEST_ISSUER);
      expect(result.value.name).toBe('Alice');
    }
    const health = verifier.getJwksFetchHealth();
    expect(health.lastSuccessAtMs).not.toBeNull();
    expect(health.consecutiveFailures).toBe(0);
  });

  it('returns auth/expired-token when exp is in the past', async () => {
    const issuedAt = Math.floor((Date.now() - TWO_HOURS_MS) / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
      .setIssuedAt(issuedAt)
      .setSubject(TEST_SUB)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setExpirationTime(issuedAt + 60)
      .sign(fixture.privateKey);
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/expired-token');
    }
  });

  it('returns auth/wrong-audience when aud claim does not match', async () => {
    const token = await signRs256({}, fixture.privateKey, { audience: 'other-audience' });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-audience');
    }
  });

  it('returns auth/wrong-issuer when iss claim does not match', async () => {
    const token = await signRs256({}, fixture.privateKey, { issuer: 'https://malicious.example' });
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-issuer');
    }
  });

  it('rejects HS256 tokens (algorithm-confusion)', async () => {
    const hsSecret = new TextEncoder().encode('this-is-a-symmetric-secret-32-bytes-long');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: TEST_KID })
      .setIssuedAt()
      .setSubject(TEST_SUB)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setExpirationTime('5m')
      .sign(hsSecret);
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/invalid-token');
    }
  });

  it('rejects azp mismatch (M9)', async () => {
    const token = await signRs256({ azp: 'different-client-id' }, fixture.privateKey);
    const verifier = buildVerifier();
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/wrong-audience');
    }
  });

  it('returns auth/jwks-unreachable when JWKS endpoint is unavailable', async () => {
    const token = await signRs256({}, fixture.privateKey);
    // Make every request fail.
    started.setRespond(() => ({ status: 503, body: '' }));
    const verifier = buildVerifier({ fetchMaxAttempts: 2 });
    const result = await verifier.verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('auth/jwks-unreachable');
    }
    const health = verifier.getJwksFetchHealth();
    expect(health.consecutiveFailures).toBeGreaterThan(0);
    expect(health.lastFailureAtMs).not.toBeNull();
  });
});
