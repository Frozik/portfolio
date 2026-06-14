import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from './AuthSession';
import type { IOidcProvider } from './oidc/IOidcProvider';
import type { IOidcProfile, IOidcSignInResult } from './oidc/types';

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

function makeGoogleProfile(): IOidcProfile {
  return {
    userId: 'google:user-1',
    name: 'Alice',
    email: 'alice@example.com',
    pictureUrl: 'https://example.com/alice.png',
  };
}

class StubProvider implements IOidcProvider {
  public readonly id: TIdentityProvider;
  public readonly displayName: string;
  public silentRefreshResult: IOidcSignInResult | null = null;
  public signOutInvocations = 0;
  public silentRefreshInvocations = 0;

  public constructor(id: TIdentityProvider, displayName: string) {
    this.id = id;
    this.displayName = displayName;
  }

  public signIn(): Promise<IOidcSignInResult | null> {
    return Promise.resolve(null);
  }

  public silentRefresh(): Promise<IOidcSignInResult | null> {
    this.silentRefreshInvocations += 1;
    return Promise.resolve(this.silentRefreshResult);
  }

  public decodeProfile(_token: string): IOidcProfile {
    if (this.id === 'yandex') {
      return {
        userId: 'yandex:42',
        name: 'Иван',
        email: 'ivan@yandex.ru',
      };
    }
    return makeGoogleProfile();
  }

  public signOut(): void {
    this.signOutInvocations += 1;
  }
}

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
    expect(session.token).toBeNull();
    expect(session.provider).toBeNull();
    expect(session.profile).toBeNull();
    expect(session.expiresAtMs).toBeNull();
  });

  it('adopts a sign-in result', () => {
    const session = new AuthSession();
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    const token = buildJwt({ sub: 'user-1', exp: expSec, iat: 0 });
    session.adoptResult('google', { token, profile: makeGoogleProfile() });

    expect(session.token).toBe(token);
    expect(session.provider).toBe('google');
    expect(session.expiresAtMs).toBe(expSec * SECONDS_PER_MS);
    expect(session.profile?.name).toBe('Alice');
    expect(session.isSignedIn).toBe(true);
  });

  it('persists the session JSON envelope and rehydrates on construction', () => {
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    const token = buildJwt({ sub: 'user-2', exp: expSec, iat: 0 });

    const first = new AuthSession();
    first.adoptResult('yandex', {
      token,
      profile: { userId: 'yandex:42', name: 'Иван' },
    });
    const persisted = sessionStorage.getItem(STORAGE_KEY) ?? '';
    expect(persisted.startsWith('{')).toBe(true);
    expect(JSON.parse(persisted)).toEqual({ provider: 'yandex', token });

    const second = new AuthSession();
    expect(second.provider).toBe('yandex');
    expect(second.token).toBe(token);
    expect(second.isSignedIn).toBe(true);
    // Profile re-decode happens via the provider lookup — until
    // `setProviders` runs, the rehydrated session has no profile.
    expect(second.profile).toBeNull();
    second.setProviders(new Map([['yandex', new StubProvider('yandex', 'Яндекс')]]));
    expect(second.profile?.name).toBe('Иван');
  });

  it('migrates legacy plain-string sessionStorage entries to Google', () => {
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    const token = buildJwt({ sub: 'legacy', exp: expSec, iat: 0 });
    sessionStorage.setItem(STORAGE_KEY, token);

    const session = new AuthSession();
    expect(session.provider).toBe('google');
    expect(session.token).toBe(token);
    expect(session.isSignedIn).toBe(true);
  });

  it('treats a malformed token as a sign-out on adoptResult', () => {
    const session = new AuthSession();
    session.adoptResult('google', {
      token: 'not-a-valid-jwt',
      profile: makeGoogleProfile(),
    });
    expect(session.token).toBeNull();
    expect(session.provider).toBeNull();
    expect(session.profile).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports isSignedIn=false once the token has expired', () => {
    const session = new AuthSession();
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 60;
    session.adoptResult('google', {
      token: buildJwt({ sub: 'user-3', exp: expSec, iat: 0 }),
      profile: makeGoogleProfile(),
    });
    expect(session.isSignedIn).toBe(true);
    vi.setSystemTime(new Date(Date.now() + 120_000));
    expect(session.isSignedIn).toBe(false);
  });

  it('clears state on signOut and forwards to every provider', () => {
    const session = new AuthSession();
    const google = new StubProvider('google', 'Google');
    const yandex = new StubProvider('yandex', 'Яндекс');
    session.setProviders(
      new Map<TIdentityProvider, IOidcProvider>([
        ['google', google],
        ['yandex', yandex],
      ])
    );
    session.adoptResult('google', {
      token: buildJwt({
        sub: 'user-4',
        exp: Math.floor(Date.now() / SECONDS_PER_MS) + 3600,
        iat: 0,
      }),
      profile: makeGoogleProfile(),
    });
    session.signOut();

    expect(session.token).toBeNull();
    expect(session.provider).toBeNull();
    expect(session.profile).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    // Both providers see the sign-out — Yandex caches an OAuth
    // access_token internally and needs to clear it.
    expect(google.signOutInvocations).toBe(1);
    expect(yandex.signOutInvocations).toBe(1);
  });

  it('routes silent refresh to the active provider', async () => {
    const session = new AuthSession();
    const google = new StubProvider('google', 'Google');
    session.setProviders(new Map([['google', google]]));
    const expSec = Math.floor(Date.now() / SECONDS_PER_MS) + 3600;
    session.adoptResult('google', {
      token: buildJwt({ sub: 'user-5', exp: expSec, iat: 0 }),
      profile: makeGoogleProfile(),
    });

    google.silentRefreshResult = {
      token: buildJwt({ sub: 'user-5', exp: expSec + 3600, iat: 0 }),
      profile: { ...makeGoogleProfile(), name: 'Alice (renamed)' },
    };
    const refreshed = await session.requestRefresh();
    expect(google.silentRefreshInvocations).toBe(1);
    expect(refreshed).not.toBeNull();
    expect(session.profile?.name).toBe('Alice (renamed)');
  });

  it('returns null on requestRefresh when no provider is registered', async () => {
    const session = new AuthSession();
    session.adoptResult('google', {
      token: buildJwt({
        sub: 'user-6',
        exp: Math.floor(Date.now() / SECONDS_PER_MS) + 3600,
        iat: 0,
      }),
      profile: makeGoogleProfile(),
    });
    const refreshed = await session.requestRefresh();
    expect(refreshed).toBeNull();
  });
});
