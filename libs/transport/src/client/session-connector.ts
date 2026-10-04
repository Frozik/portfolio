import { settleTeardown } from '../frame/settle';
import type { ITransportSession, TransportProtocol } from '../shared/session';

export type TransportMode = 'auto' | TransportProtocol;

export type TransportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'open'; readonly protocol: TransportProtocol }
  | { readonly kind: 'failed'; readonly reason: string };

export interface SessionOpeners {
  /** Absent where the browser has no WebTransport. */
  readonly http3: (() => Promise<ITransportSession>) | undefined;
  readonly websocket: () => ITransportSession;
}

export interface SessionConnectorOptions {
  readonly openers: SessionOpeners;
  readonly mode: TransportMode;
  readonly connectTimeoutMs: number;
  /** After HTTP/3 fails, reconnects go straight to the fallback for this long. */
  readonly http3RetryAfterMs: number;
  readonly now: () => number;
}

interface OpenedSession {
  readonly session: ITransportSession;
  readonly protocol: TransportProtocol;
}

/** Owns the one live session: opens it lazily, prefers HTTP/3, falls back, reopens after a drop. */
export class SessionConnector {
  private current: Promise<ITransportSession> | undefined;
  private generation = 0;
  private http3FailedAt: number | undefined;
  private stateValue: TransportState = { kind: 'idle' };
  private mode: TransportMode;
  private readonly listeners = new Set<(state: TransportState) => void>();

  constructor(private readonly options: SessionConnectorOptions) {
    this.mode = options.mode;
  }

  get state(): TransportState {
    return this.stateValue;
  }

  session(): Promise<ITransportSession> {
    if (this.current === undefined) {
      this.generation += 1;
      this.current = this.connect(this.generation);
    }
    return this.current;
  }

  subscribe(listener: (state: TransportState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMode(mode: TransportMode): void {
    this.mode = mode;
    this.http3FailedAt = undefined;
    this.drop();
  }

  dispose(): void {
    this.drop();
    this.listeners.clear();
  }

  private drop(): void {
    const current = this.current;
    this.current = undefined;
    this.generation += 1;
    this.setState({ kind: 'idle' });
    if (current !== undefined) {
      settleTeardown(current.then(session => session.close()));
    }
  }

  private async connect(generation: number): Promise<ITransportSession> {
    this.setState({ kind: 'connecting' });
    try {
      const { session, protocol } = await this.open();
      if (this.generation !== generation) {
        session.close();
        throw new Error('transport mode changed while connecting');
      }
      this.setState({ kind: 'open', protocol });
      const forget = () => this.forget(generation);
      session.closed.then(forget, forget);
      return session;
    } catch (error) {
      if (this.generation === generation) {
        this.current = undefined;
        this.setState({
          kind: 'failed',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  private forget(generation: number): void {
    if (this.generation === generation && this.current !== undefined) {
      this.current = undefined;
      this.setState({ kind: 'idle' });
    }
  }

  private async open(): Promise<OpenedSession> {
    const http3 = this.options.openers.http3;
    if (http3 !== undefined && this.shouldTryHttp3()) {
      try {
        return { session: await this.ready(await http3()), protocol: 'http3' };
      } catch (error) {
        this.http3FailedAt = this.options.now();
        if (this.mode === 'http3') {
          throw error;
        }
      }
    }
    if (this.mode === 'http3') {
      throw new Error('HTTP/3 is not available in this browser');
    }
    return { session: await this.ready(this.options.openers.websocket()), protocol: 'websocket' };
  }

  private shouldTryHttp3(): boolean {
    switch (this.mode) {
      case 'websocket':
        return false;
      case 'http3':
        return true;
      case 'auto':
        return (
          this.http3FailedAt === undefined ||
          this.options.now() - this.http3FailedAt >= this.options.http3RetryAfterMs
        );
    }
  }

  private async ready(session: ITransportSession): Promise<ITransportSession> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no session within ${this.options.connectTimeoutMs} ms`)),
        this.options.connectTimeoutMs
      );
    });
    try {
      await Promise.race([session.ready, timeout]);
      return session;
    } catch (error) {
      settleTeardown(session.ready);
      settleTeardown(session.closed);
      session.close();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private setState(state: TransportState): void {
    this.stateValue = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
