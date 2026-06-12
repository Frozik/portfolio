import { useEffect, useRef, useState } from 'react';
import type { ICommunicationClient } from './CommunicationClient';
import { createCommunicationClient } from './CommunicationClient';
import { useAuthSession, useCommunicationBaseUrl } from './CommunicationProvider';

/**
 * Refcount entry kept per `(baseUrl, roomId)` pair. Multiple components
 * mounted against the same room share one connection. A short
 * `cleanupHandle` window after the last release absorbs React 19
 * strict-mode's mount → cleanup → mount cycle: the cleanup decrements
 * the refcount to zero and arms a deferred disconnect; the immediate
 * remount finds the entry still cached, cancels the pending disconnect,
 * and bumps the refcount back to 1 — without ever tearing down the
 * Socket.IO handshake mid-flight.
 */
interface IPoolEntry {
  client: ICommunicationClient;
  refCount: number;
  cleanupHandle: ReturnType<typeof setTimeout> | null;
}

const STRICT_MODE_GRACE_MS = 100;

const clientPool = new Map<string, IPoolEntry>();

/**
 * The auth mode is part of the key: an authenticated and an anonymous
 * consumer for the SAME (baseUrl, roomId) — e.g. a retro and a conf room
 * that happen to share a roomId — must NOT share one socket, or the second
 * caller would inherit a client connected in the wrong identity mode.
 */
function poolKey(baseUrl: string, roomId: string, mode: 'auth' | 'anon'): string {
  return `${mode}::${baseUrl}::${roomId}`;
}

function acquireClient(key: string, factory: () => ICommunicationClient): ICommunicationClient {
  const cached = clientPool.get(key);
  if (cached !== undefined) {
    if (cached.cleanupHandle !== null) {
      clearTimeout(cached.cleanupHandle);
      cached.cleanupHandle = null;
    }
    cached.refCount += 1;
    return cached.client;
  }
  const created = factory();
  clientPool.set(key, { client: created, refCount: 1, cleanupHandle: null });
  created.connect();
  return created;
}

function releaseClient(key: string): void {
  const entry = clientPool.get(key);
  if (entry === undefined) {
    return;
  }
  entry.refCount -= 1;
  if (entry.refCount > 0) {
    return;
  }
  entry.cleanupHandle = setTimeout(() => {
    const current = clientPool.get(key);
    if (current === undefined || current.refCount > 0) {
      return;
    }
    current.client.disconnect();
    clientPool.delete(key);
  }, STRICT_MODE_GRACE_MS);
}

/**
 * Acquire a `CommunicationClient` connected to the new server for
 * the given `roomId`. Backed by a refcounted module-scoped pool: every
 * caller for the same `(baseUrl, roomId)` shares one connection.
 *
 * Token-refresh flow
 * ------------------
 * The server emits `auth:token-expiring` shortly before a Google ID
 * token would expire. The hook delegates the refresh to `AuthSession`,
 * which calls `window.google.accounts.id.prompt()` (FedCM on supported
 * browsers, legacy iframe elsewhere) to silently mint a fresh token —
 * see `googleSilentRefresh.ts`. The session also schedules a proactive
 * refresh ahead of `exp` so a long-idle tab does not have to wait for
 * the server's expiring hint to roll over the credential.
 *
 * If GIS declines to issue a new token (no Google session, origin not
 * authorized, FedCM denied) the handler resolves `null`; the server
 * then emits `auth:token-expired`, the session signs out, and
 * `<SignInGate>` re-renders the explicit sign-in button.
 */
export function useCommunicationClient(roomId: string): ICommunicationClient | null {
  const session = useAuthSession();
  const baseUrl = useCommunicationBaseUrl();
  const [client, setClient] = useState<ICommunicationClient | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!session.isSignedIn) {
      setClient(null);
      return undefined;
    }
    const key = poolKey(baseUrl, roomId, 'auth');
    const acquired = acquireClient(key, () =>
      createCommunicationClient({
        baseUrl,
        roomId,
        getCredentials: () => {
          const current = sessionRef.current;
          if (current.provider === null || current.token === null) {
            return null;
          }
          return { provider: current.provider, token: current.token };
        },
        onTokenRefreshNeeded: () => sessionRef.current.requestRefresh(),
      })
    );
    const offTokenExpired = acquired.onTokenExpired(() => sessionRef.current.signOut());
    setClient(acquired);
    return () => {
      offTokenExpired();
      releaseClient(key);
    };
    // We deliberately read `session.isSignedIn` (a primitive) so a
    // sign-out tears down the client; further token churn while
    // signed in is handled inside the client.
  }, [baseUrl, roomId, session, session.isSignedIn]);

  return client;
}

/**
 * Anonymous variant of {@link useCommunicationClient}. Skips the
 * `AuthSession` dependency entirely — the handshake sends only
 * `{ roomId }` and the server assigns a `Guest` identity scoped to
 * this socket. Backed by the same refcounted pool, so multiple
 * components mounted against the same `(baseUrl, roomId)` share one
 * connection.
 *
 * Use this for features that do not need user identity (e.g. conf
 * rooms identified by URL only). Token refresh / expiry events never
 * fire on this path.
 */
export function useAnonymousCommunicationClient(roomId: string): ICommunicationClient | null {
  const baseUrl = useCommunicationBaseUrl();
  const [client, setClient] = useState<ICommunicationClient | null>(null);

  useEffect(() => {
    const key = poolKey(baseUrl, roomId, 'anon');
    const acquired = acquireClient(key, () =>
      createCommunicationClient({
        baseUrl,
        roomId,
      })
    );
    setClient(acquired);
    return () => {
      releaseClient(key);
    };
  }, [baseUrl, roomId]);

  return client;
}
