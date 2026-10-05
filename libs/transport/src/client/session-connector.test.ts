import type { ITransportSession } from '../shared/session';
import type { SessionOpeners, TransportMode, TransportState } from './session-connector';
import { SessionConnector } from './session-connector';

const CONNECT_TIMEOUT_MS = 20;
const RETRY_AFTER_MS = 1000;

interface FakeSession extends ITransportSession {
  drop(): void;
}

const labels = new WeakMap<ITransportSession, string>();

type SessionOutcome = 'opens' | 'fails' | 'hangs' | 'no-streams';

/** `no-streams` is Safari against a server that grants no stream credit: ready, but no stream ever opens. */
function fakeSession(label: string, outcome: SessionOutcome): FakeSession {
  const closing = Promise.withResolvers<void>();
  const ready =
    outcome === 'opens' || outcome === 'no-streams'
      ? Promise.resolve()
      : outcome === 'fails'
        ? Promise.reject(new Error(`${label} unreachable`))
        : new Promise<void>(() => undefined);
  const session: FakeSession = {
    ready,
    closed: closing.promise,
    incomingBidirectionalStreams: new ReadableStream(),
    createBidirectionalStream: () =>
      outcome === 'opens'
        ? Promise.resolve({ readable: new ReadableStream(), writable: new WritableStream() })
        : new Promise(() => undefined),
    close: () => closing.resolve(),
    drop: () => closing.resolve(),
  };
  labels.set(session, label);
  return session;
}

function connector(
  http3: (() => FakeSession) | undefined,
  websocket: () => FakeSession,
  mode: TransportMode = 'auto',
  clock = { now: 0 }
) {
  const openers: SessionOpeners = {
    http3: http3 === undefined ? undefined : () => Promise.resolve(http3()),
    websocket,
  };
  const instance = new SessionConnector({
    openers,
    mode,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    http3RetryAfterMs: RETRY_AFTER_MS,
    now: () => clock.now,
  });
  const states: TransportState[] = [];
  instance.subscribe(state => states.push(state));
  return { instance, states, clock };
}

async function labelOf(session: Promise<ITransportSession>): Promise<string> {
  return labels.get(await session) ?? 'unknown';
}

describe('session connector', () => {
  it('uses HTTP/3 when it answers', async () => {
    const { instance, states } = connector(
      () => fakeSession('h3', 'opens'),
      () => fakeSession('ws', 'opens')
    );

    expect(await labelOf(instance.session())).toBe('h3');
    expect(states.at(-1)).toEqual({ kind: 'open', protocol: 'http3' });
  });

  it('falls back to the WebSocket when HTTP/3 fails or does not answer in time', async () => {
    for (const outcome of ['fails', 'hangs'] as const) {
      const { instance, states } = connector(
        () => fakeSession('h3', outcome),
        () => fakeSession('ws', 'opens')
      );

      expect(await labelOf(instance.session())).toBe('ws');
      expect(states.at(-1)).toEqual({ kind: 'open', protocol: 'websocket' });
    }
  });

  it('falls back when an HTTP/3 session opens but cannot open a stream', async () => {
    const { instance, states } = connector(
      () => fakeSession('h3', 'no-streams'),
      () => fakeSession('ws', 'opens')
    );

    expect(await labelOf(instance.session())).toBe('ws');
    expect(states.at(-1)).toEqual({ kind: 'open', protocol: 'websocket' });
  });

  it('says why a forced HTTP/3 session is unusable when no stream opens', async () => {
    const { instance, states } = connector(
      () => fakeSession('h3', 'no-streams'),
      () => fakeSession('ws', 'opens'),
      'http3'
    );

    await expect(instance.session()).rejects.toThrow(/no stream/);
    expect(states.at(-1)).toEqual(expect.objectContaining({ kind: 'failed' }));
  });

  it('goes straight to the WebSocket where the browser has no WebTransport', async () => {
    const { instance } = connector(undefined, () => fakeSession('ws', 'opens'));

    expect(await labelOf(instance.session())).toBe('ws');
  });

  it('skips HTTP/3 on reconnects for a while after it failed, then tries it again', async () => {
    let http3Attempts = 0;
    const sessions: FakeSession[] = [];
    const { instance, clock } = connector(
      () => {
        http3Attempts += 1;
        return fakeSession('h3', 'fails');
      },
      () => {
        const session = fakeSession('ws', 'opens');
        sessions.push(session);
        return session;
      }
    );

    await instance.session();
    sessions[0]?.drop();
    await sessions[0]?.closed;
    await instance.session();
    expect(http3Attempts).toBe(1);

    clock.now = RETRY_AFTER_MS;
    sessions[1]?.drop();
    await sessions[1]?.closed;
    await instance.session();
    expect(http3Attempts).toBe(2);
  });

  it('reuses one live session for concurrent callers', async () => {
    let opened = 0;
    const { instance } = connector(
      () => {
        opened += 1;
        return fakeSession('h3', 'opens');
      },
      () => fakeSession('ws', 'opens')
    );

    await Promise.all([instance.session(), instance.session(), instance.session()]);

    expect(opened).toBe(1);
  });

  it('reports failure when the forced protocol is unreachable', async () => {
    const { instance, states } = connector(
      () => fakeSession('h3', 'fails'),
      () => fakeSession('ws', 'opens'),
      'http3'
    );

    await expect(instance.session()).rejects.toThrow(/unreachable/);
    expect(states.at(-1)).toEqual({ kind: 'failed', reason: 'h3 unreachable' });
  });

  it('closes the current session and reconnects with the new mode when the mode changes', async () => {
    const opened: FakeSession[] = [];
    const record = (label: string) => () => {
      const session = fakeSession(label, 'opens');
      opened.push(session);
      return session;
    };
    const { instance } = connector(record('h3'), record('ws'));

    await instance.session();
    instance.setMode('websocket');

    expect(await labelOf(instance.session())).toBe('ws');
    await expect(opened[0]?.closed).resolves.toBeUndefined();
  });
});
