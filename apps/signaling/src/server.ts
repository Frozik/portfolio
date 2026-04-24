import http from 'node:http';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

/**
 * y-webrtc signaling server.
 *
 * y-webrtc treats the signaling channel as a pub/sub bus over WebSocket.
 * Peers subscribe to topics (one topic = one Yjs room id), then exchange
 * SDP offers / answers / ICE candidates by publishing messages to the
 * topic. The server does not inspect message contents — it only relays.
 *
 * After the WebRTC handshake completes, all data flows peer-to-peer over
 * a direct DataChannel and the server becomes idle for that pair.
 *
 * Protocol messages (JSON):
 *   { type: "subscribe",   topics: string[] }       — join topics
 *   { type: "unsubscribe", topics: string[] }       — leave topics
 *   { type: "publish",     topic: string, ... }     — broadcast to topic
 *   { type: "ping" }                                — replies with pong
 *
 * Dead-connection detection uses WS-level ping/pong on a 30s interval.
 */

const DEFAULT_PORT = 4444;
const PING_INTERVAL_MS = 30_000;
const KEEPALIVE_INTERVAL_MS = 60_000;

/**
 * Origin allowlist used for both the WebSocket upgrade and the HTTP CORS
 * reflection.
 *
 * Browsers attach `Origin: scheme://host[:port]` to cross-origin requests;
 * non-browser clients (curl, custom scripts) can spoof it, so this check
 * is not a security boundary — it only stops casual reuse of the server
 * from unrelated web apps. Real abuse should be blocked at the edge
 * (nginx ACL) or with auth tokens in the URL.
 *
 * Allowed:
 *   - https://frozik.github.io          (deployed portfolio, any path)
 *   - http(s)://localhost[:port]        (local dev, any port, any protocol)
 */
const ORIGIN_PREDICATES: ReadonlyArray<(url: URL) => boolean> = [
  url => url.protocol === 'https:' && url.hostname === 'frozik.github.io',
  url => (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === 'localhost',
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (origin === undefined || origin.length === 0) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  return ORIGIN_PREDICATES.some(predicate => predicate(parsed));
}

type SignalingMessage =
  | { type: 'subscribe'; topics?: readonly string[] }
  | { type: 'unsubscribe'; topics?: readonly string[] }
  | ({ type: 'publish'; topic?: string } & Record<string, unknown>)
  | { type: 'ping' };

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65_535) {
    return DEFAULT_PORT;
  }
  return parsed;
}

function safeSend(connection: WebSocket, payload: unknown): void {
  if (connection.readyState !== connection.OPEN) {
    return;
  }
  try {
    connection.send(JSON.stringify(payload));
  } catch {
    connection.close();
  }
}

function parseMessage(raw: unknown): SignalingMessage | null {
  try {
    const text = typeof raw === 'string' ? raw : raw instanceof Buffer ? raw.toString() : null;
    if (text === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || !('type' in parsed)) {
      return null;
    }
    return parsed as SignalingMessage;
  } catch {
    return null;
  }
}

const port = parsePort(process.env.PORT);

const topics = new Map<string, Set<WebSocket>>();
const startedAtMs = Date.now();

function countPeers(): number {
  let total = 0;
  topics.forEach(subscribers => {
    total += subscribers.size;
  });
  return total;
}

// CORS: the portfolio client probes /health from the browser before
// opening the WS, and that fetch is cross-origin. We reuse the same
// allowlist as the WS upgrade — reflecting the Origin back is safer than
// a blanket `*` and also permits credentialed requests if we ever need
// them. Requests from disallowed origins get no CORS headers at all, so
// the browser blocks the response (which is what we want).
function buildCorsHeaders(origin: string | undefined): Record<string, string> {
  if (!isOriginAllowed(origin) || origin === undefined) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const server = http.createServer((request, response) => {
  const corsHeaders = buildCorsHeaders(request.headers.origin);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }
  const url = request.url ?? '/';
  if (url === '/health' || url.startsWith('/health?')) {
    const body = JSON.stringify({
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
      topics: topics.size,
      peers: countPeers(),
    });
    response.writeHead(200, {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(`${body}\n`);
    return;
  }
  response.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/plain' });
  response.end('y-webrtc signaling: ok\n');
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (connection: WebSocket) => {
  const subscribed = new Set<string>();
  let isAlive = true;

  const pingIntervalId = setInterval(() => {
    if (!isAlive) {
      connection.terminate();
      return;
    }
    isAlive = false;
    try {
      connection.ping();
    } catch {
      connection.terminate();
    }
  }, PING_INTERVAL_MS);

  connection.on('pong', () => {
    isAlive = true;
  });

  connection.on('close', () => {
    clearInterval(pingIntervalId);
    subscribed.forEach(topicName => {
      const subscribers = topics.get(topicName);
      if (subscribers === undefined) {
        return;
      }
      subscribers.delete(connection);
      if (subscribers.size === 0) {
        topics.delete(topicName);
      }
    });
    subscribed.clear();
  });

  connection.on('message', raw => {
    const message = parseMessage(raw);
    if (message === null) {
      return;
    }
    switch (message.type) {
      case 'subscribe': {
        message.topics?.forEach(topicName => {
          if (typeof topicName !== 'string' || topicName.length === 0) {
            return;
          }
          let subscribers = topics.get(topicName);
          if (subscribers === undefined) {
            subscribers = new Set();
            topics.set(topicName, subscribers);
          }
          subscribers.add(connection);
          subscribed.add(topicName);
        });
        return;
      }
      case 'unsubscribe': {
        message.topics?.forEach(topicName => {
          if (typeof topicName !== 'string') {
            return;
          }
          const subscribers = topics.get(topicName);
          subscribers?.delete(connection);
          subscribed.delete(topicName);
        });
        return;
      }
      case 'publish': {
        if (typeof message.topic !== 'string') {
          return;
        }
        const subscribers = topics.get(message.topic);
        if (subscribers === undefined) {
          return;
        }
        const payload = { ...message, clients: subscribers.size };
        subscribers.forEach(subscriber => {
          if (subscriber !== connection) {
            safeSend(subscriber, payload);
          }
        });
        return;
      }
      case 'ping': {
        safeSend(connection, { type: 'pong' });
        return;
      }
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  if (!isOriginAllowed(origin)) {
    console.warn(`[signaling] rejecting upgrade from origin=${origin ?? '<missing>'}`);
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request);
  });
});

// Periodic stats log — helps spot dead rooms and dropped peers in Fly logs.
setInterval(() => {
  console.log(
    `[signaling] topics=${topics.size} peers=${countPeers()} at ${new Date().toISOString()}`
  );
}, KEEPALIVE_INTERVAL_MS);

server.listen(port, () => {
  console.log(`[signaling] y-webrtc signaling listening on port ${port}`);
});

const shutdown = (signal: string): void => {
  console.log(`[signaling] received ${signal}, closing`);
  wss.clients.forEach(client => client.close(1001, 'server shutdown'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
