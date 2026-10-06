import type { MuxSessionOptions } from '../mux/mux-session';
import { createMuxSession } from '../mux/mux-session';
import { MUX_WIRES } from '../mux/mux-wire';
import type { ITransportSession } from '../shared/session';
import type { WireFormat } from '../shared/wire-format';
import { createMemorySocketPair } from './memory-socket';

export const TEST_MUX_LIMITS = {
  initialCredit: 64 * 1024,
  maxDataBytes: 16 * 1024,
  maxIncomingStreams: 8,
  sendBufferBytes: 64 * 1024,
  drainPollMs: 1,
} as const;

/** A client and a server session joined in memory through the WebSocket multiplexer. */
export function createMemorySessionPair(
  limits: Omit<MuxSessionOptions, 'role' | 'wire'> = TEST_MUX_LIMITS,
  format: WireFormat = 'binary'
): { readonly client: ITransportSession; readonly server: ITransportSession } {
  const [clientSocket, serverSocket] = createMemorySocketPair();
  const wire = MUX_WIRES[format];
  return {
    client: createMuxSession(clientSocket, { ...limits, wire, role: 'client' }),
    server: createMuxSession(serverSocket, { ...limits, wire, role: 'server' }),
  };
}
