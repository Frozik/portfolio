import type { Socket } from 'socket.io';
import type { TokenLifecycle } from '../application/TokenLifecycle';
import type { Identity, TokenClaims } from '../domain/Identity';
import type { RoomId } from '../domain/types';

export type SocketContextData = {
  identity: Identity;
  /** `null` for anonymous handshakes — no token lifecycle, no refresh. */
  claims: TokenClaims | null;
  roomId: RoomId;
  /** `null` for anonymous handshakes — there is no token to expire. */
  tokenLifecycle: TokenLifecycle | null;
  turnCredsBucket: { count: number; windowStartMs: number };
  inflightControllers: Set<AbortController>;
};

// The context lives as ONE object under `socket.data.ctx` and is always read
// and mutated by reference. Copying fields out (the previous shape) made
// refresh-handler mutations invisible to the token-lifecycle callbacks, which
// re-read the context later and saw stale claims.
type SocketWithData = Socket & { data: { ctx?: SocketContextData } };

export function readContext(socket: Socket): SocketContextData | null {
  return (socket as SocketWithData).data.ctx ?? null;
}

export function writeContext(socket: Socket, context: SocketContextData): void {
  (socket as SocketWithData).data.ctx = context;
}
