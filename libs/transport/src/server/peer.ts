import { createContextKey } from '@connectrpc/connect';

import type { TransportProtocol } from '../shared/session';

/**
 * The client's own address for the call, as RPC handlers see it in
 * `context.values`; undefined where only a proxy's address is known.
 */
export const TRANSPORT_CLIENT_ADDRESS = createContextKey<string | undefined>(undefined, {
  description: 'transport client address',
});

/** Which protocol carries the call. */
export const TRANSPORT_PROTOCOL = createContextKey<TransportProtocol>('http3', {
  description: 'transport protocol',
});

export interface SessionRequest {
  readonly ip: string;
  readonly origin: string | undefined;
}

const BRACKETED_IPV6 = /^\[(?<address>[^\]]+)\](?::\d+)?$/;
const IPV4_WITH_PORT = /^(?<address>[\d.]+):\d+$/;

/** `1.2.3.4:5678` → `1.2.3.4`, `[::1]:5678` → `::1`; anything else is returned as is. */
export function ipOf(address: string): string {
  return (
    BRACKETED_IPV6.exec(address)?.groups?.address ??
    IPV4_WITH_PORT.exec(address)?.groups?.address ??
    address
  );
}
