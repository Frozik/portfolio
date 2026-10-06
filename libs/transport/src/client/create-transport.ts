import type { Transport } from '@connectrpc/connect';

import type { WireFormat } from '../shared/wire-format';

import { openWebSocketSession } from './browser-websocket';
import { transportEndpoints } from './endpoints';
import { isWebTransportAvailable, openWebTransport } from './native-webtransport';
import type { TransportMode, TransportState } from './session-connector';
import { SessionConnector } from './session-connector';
import { createSessionTransport } from './session-transport';

export interface TransportOptions {
  /** The server's own URL; both protocols' addresses follow from it (see `transportEndpoints`). */
  readonly serverUrl: string;
  /** Where the server mounts the transport. */
  readonly path?: string;
  readonly mode?: TransportMode;
  readonly connectTimeoutMs?: number;
  readonly http3RetryAfterMs?: number;
  readonly readMaxBytes?: number;
  /** `binary` unless set; `json` makes the wire readable for debugging (`WireFormat`). */
  readonly wireFormat?: WireFormat;
}

/** A Connect transport that also reports which protocol carries it. */
export interface ITransport extends Transport {
  readonly state: TransportState;
  subscribe(listener: (state: TransportState) => void): () => void;
  setMode(mode: TransportMode): void;
  readonly wireFormat: WireFormat;
  /** Applies from the next call; the WebSocket reconnects to name the new subprotocol. */
  setWireFormat(format: WireFormat): void;
  dispose(): void;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 4000;
const DEFAULT_HTTP3_RETRY_AFTER_MS = 5 * 60 * 1000;
const DEFAULT_READ_MAX_BYTES = 1024 * 1024;
const DEFAULT_PATH = '/transport';
/** Only the path of a call travels to the server's routing; the origin is a placeholder. */
const TUNNEL_BASE_URL = 'https://transport.invalid';

/**
 * One Connect transport for every service: it prefers HTTP/3 (WebTransport)
 * and falls back to a multiplexed WebSocket on its own.
 */
export function createTransport(options: TransportOptions): ITransport {
  const endpoints = transportEndpoints(options.serverUrl, options.path ?? DEFAULT_PATH);
  let wireFormat = options.wireFormat ?? 'binary';
  const connector = new SessionConnector({
    openers: {
      http3: isWebTransportAvailable()
        ? async () => {
            const target = await endpoints.http3();
            return openWebTransport(target.url, target.serverCertificateHashes);
          }
        : undefined,
      websocket: () => openWebSocketSession(endpoints.fallbackUrl, wireFormat),
    },
    mode: options.mode ?? 'auto',
    connectTimeoutMs: options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    http3RetryAfterMs: options.http3RetryAfterMs ?? DEFAULT_HTTP3_RETRY_AFTER_MS,
    now: () => performance.now(),
  });
  const transport = createSessionTransport({
    openStream: async () => (await connector.session()).createBidirectionalStream(),
    baseUrl: TUNNEL_BASE_URL,
    readMaxBytes: options.readMaxBytes ?? DEFAULT_READ_MAX_BYTES,
    wireFormat: () => wireFormat,
  });
  return {
    unary: transport.unary.bind(transport),
    stream: transport.stream.bind(transport),
    get state() {
      return connector.state;
    },
    subscribe: listener => connector.subscribe(listener),
    setMode: mode => connector.setMode(mode),
    get wireFormat() {
      return wireFormat;
    },
    setWireFormat: format => {
      if (format !== wireFormat) {
        wireFormat = format;
        connector.reconnect();
      }
    },
    dispose: () => connector.dispose(),
  };
}
