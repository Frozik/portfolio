import type { Socket } from 'socket.io';
import type { IServerLogger } from '../application/ports/IServerLogger';

/**
 * Registers a socket event handler whose protocol requires an ack callback.
 *
 * Socket.IO passes through whatever the client sent — a malicious emit
 * without an ack leaves `ack` undefined, and calling it would throw inside
 * the listener. For async handlers that surfaces as an unhandled rejection,
 * which kills the whole process (trivial remote DoS). The wrapper validates
 * the callback and contains both sync and async handler failures.
 */
export function registerAckHandler<TAck>(
  socket: Socket,
  event: string,
  logger: IServerLogger,
  handler: (raw: unknown, ack: (response: TAck) => void) => void | Promise<void>
): void {
  socket.on(event, (raw: unknown, ack: unknown) => {
    if (typeof ack !== 'function') {
      logger.warn('socket-handlers.missing-ack', { event });
      return;
    }
    void Promise.resolve()
      .then(() => handler(raw, ack as (response: TAck) => void))
      .catch((caught: unknown) => {
        logger.warn('socket-handlers.handler-failed', {
          event,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });
  });
}
