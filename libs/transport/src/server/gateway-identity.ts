import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { MUX_SUBPROTOCOL } from '../mux/mux-limits';
import type { SessionRequest } from './peer';

/** Set by the HTTP/3 gateway to the browser's address; read only on the gateway's own listener. */
export const GATEWAY_CLIENT_ADDRESS_HEADER = 'x-transport-client-address';

const BEARER = 'Bearer ';

/** A session that came straight from the browser: its socket address and Origin. */
export function identifyDirectRequest(request: IncomingMessage): SessionRequest {
  return { ip: request.socket.remoteAddress ?? '', origin: request.headers.origin };
}

/**
 * A session the HTTP/3 gateway opened for a browser. The gateway proves itself
 * with the shared secret and names the mux version; the address and Origin it
 * forwards are the browser's. Anything else is refused, so nobody who reaches
 * this listener without the secret can claim an address.
 */
export function identifyGatewayRequest(
  secret: string
): (request: IncomingMessage) => SessionRequest | undefined {
  const expected = digest(secret);
  return request => {
    const authorization = request.headers.authorization ?? '';
    const offered = (request.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map(name => name.trim());
    const address = request.headers[GATEWAY_CLIENT_ADDRESS_HEADER];
    if (
      !authorization.startsWith(BEARER) ||
      !timingSafeEqual(digest(authorization.slice(BEARER.length)), expected) ||
      !offered.includes(MUX_SUBPROTOCOL) ||
      typeof address !== 'string' ||
      address.length === 0
    ) {
      return undefined;
    }
    return { ip: address, origin: request.headers.origin };
  };
}

/** Equal-length digests let the comparison run in constant time whatever the secret's length. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
