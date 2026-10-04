import type { MuxSessionOptions } from '../mux/mux-session';
import { createMuxSession } from '../mux/mux-session';
import type { ITransportSession } from '../shared/session';
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
  limits: Omit<MuxSessionOptions, 'role'> = TEST_MUX_LIMITS
): { readonly client: ITransportSession; readonly server: ITransportSession } {
  const [clientSocket, serverSocket] = createMemorySocketPair();
  return {
    client: createMuxSession(clientSocket, { ...limits, role: 'client' }),
    server: createMuxSession(serverSocket, { ...limits, role: 'server' }),
  };
}
