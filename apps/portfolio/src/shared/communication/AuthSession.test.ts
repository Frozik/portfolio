import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSession } from './AuthSession';

const SECONDS_PER_MS = 1_000;

const ENCODED_HEADER = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const SIGNATURE = 'sig';

function buildJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${ENCODED_HEADER}.${encoded}.${SIGNATURE}`;
}

const STORAGE_KEY = 'communication.auth.idToken';

describe('AuthSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts signed-out when sessionStorage is empty', () => {
    const session = new AuthSession();
    expect(session.isSignedIn).toBe(false);
    expect(session.idToken).toBeNull();
    expect(session.profile).toBeNull();
    expect(session.expiresAtMs).toBeNull();
  });

  it('decodes a Google ID token into a profile snapshot', () => {
    const session = new AuthSession();
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    const token = buildJwt({
      sub: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      picture: 'https://example.com/alice.png',
      exp: expSec,
      iat: Math.floor(Date.now() / SECONDS_PER_MS),
    });

    session.setIdToken(token);

    expect(session.idToken).toBe(token);
    expect(session.expiresAtMs).toBe(expSec * SECONDS_PER_MS);
    expect(session.profile).toEqual({
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      pictureUrl: 'https://example.com/alice.png',
    });
    expect(session.isSignedIn).toBe(true);
  });

  it('persists the token to sessionStorage and rehydrates on construction', () => {
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    const token = buildJwt({ sub: 'user-2', name: 'Bob', exp: expSec, iat: 0 });

    const first = new AuthSession();
    first.setIdToken(token);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(token);

    const second = new AuthSession();
    expect(second.idToken).toBe(token);
    expect(second.profile?.name).toBe('Bob');
    expect(second.isSignedIn).toBe(true);
  });

  it('treats a malformed token as a sign-out', () => {
    const session = new AuthSession();
    session.setIdToken('not-a-valid-jwt');
    expect(session.idToken).toBeNull();
    expect(session.profile).toBeNull();
    expect(session.expiresAtMs).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports isSignedIn=false once the token has expired', () => {
    const session = new AuthSession();
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 60;
    session.setIdToken(buildJwt({ sub: 'user-3', name: 'Carol', exp: expSec, iat: 0 }));
    expect(session.isSignedIn).toBe(true);

    vi.setSystemTime(new Date(Date.now() + 120_000));
    expect(session.isSignedIn).toBe(false);
  });

  it('clears state on signOut', () => {
    const session = new AuthSession();
    session.setIdToken(
      buildJwt({
        sub: 'user-4',
        name: 'Dave',
        exp: Math.floor(Date.now() / SECONDS_PER_MS) + 3600,
        iat: 0,
      })
    );
    session.signOut();
    expect(session.idToken).toBeNull();
    expect(session.profile).toBeNull();
    expect(session.expiresAtMs).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('falls back to "Anonymous" when the JWT lacks a name claim', () => {
    const session = new AuthSession();
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    session.setIdToken(buildJwt({ sub: 'user-5', exp: expSec, iat: 0 }));
    expect(session.profile?.name).toBe('Anonymous');
  });
});
