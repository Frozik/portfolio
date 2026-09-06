import { AUTH_REFRESH_TOKEN } from '@frozik/communication-protocol/events';
import type { IRefreshTokenAck } from '@frozik/communication-protocol/messages';
import { assert } from '@frozik/utils/assert/assert';
import type { Socket } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import type { ConnectionLifecycle } from '../application/ConnectionLifecycle';
import type { ILifecycleTransport } from '../application/ports/ILifecycleTransport';
import type { IServerLogger } from '../application/ports/IServerLogger';
import type { PresenceBroadcaster } from '../application/PresenceBroadcaster';
import { InvalidPayloadError } from '../domain/errors';
import type { Identity } from '../domain/Identity';
import { parseRefreshTokenPayload } from '../domain/protocol-validators';
import type { Room } from '../domain/Room';
import { assertDisplayName } from '../domain/types';
import { registerAckHandler } from './ack-handler';
import type { CommunicationMetrics } from './metrics';
import { readContext } from './socket-context';

export type TokenRefreshDeps = {
  connectionLifecycle: ConnectionLifecycle;
  presenceBroadcaster: PresenceBroadcaster;
  transport: ILifecycleTransport;
  logger: IServerLogger;
  metrics: CommunicationMetrics;
};

type TokenLifecycleCallbacks = { onWarning: (secs: number) => void; onExpired: () => void };

function buildTokenLifecycleCallbacks(
  socket: Socket,
  transport: ILifecycleTransport
): TokenLifecycleCallbacks {
  return {
    onWarning(secondsRemaining: number): void {
      const ctx = readContext(socket);
      // An anonymous handshake never arms the lifecycle, so this only guards a race.
      if (ctx === null || ctx.claims === null) {
        return;
      }
      transport.emitTokenExpiring(socket.id, {
        expiresAt: Temporal.Instant.fromEpochMilliseconds(ctx.claims.exp).toString(),
        secondsRemaining,
      });
    },
    onExpired(): void {
      transport.emitTokenExpired(socket.id);
      transport.disconnect(socket.id, 'auth/expired');
    },
  };
}

/** Starts the expiry warning and cut-off timers for a token-bearing session. */
export function armTokenLifecycle(socket: Socket, transport: ILifecycleTransport): void {
  const ctx = readContext(socket);
  assert(ctx !== null, 'socket context must be populated before arming token lifecycle');
  // Anonymous handshakes have no token to expire — there's nothing to arm.
  if (ctx.claims === null || ctx.tokenLifecycle === null) {
    return;
  }
  ctx.tokenLifecycle.arm(ctx.claims, buildTokenLifecycleCallbacks(socket, transport));
}

/**
 * Per M14: a display name that changed with the refreshed token is
 * re-broadcast. The room stores an immutable Identity, so the member is
 * re-added; the domain layer dedupes by userId. A name claim that fails the
 * displayName contract keeps the old identity — the refresh itself succeeded.
 */
function renameIfChanged(
  socket: Socket,
  room: Room,
  newName: unknown,
  deps: TokenRefreshDeps
): void {
  const ctx = readContext(socket);
  if (ctx === null || typeof newName !== 'string') {
    return;
  }
  const trimmed = newName.trim();
  if (trimmed === '' || trimmed === ctx.identity.displayName) {
    return;
  }
  try {
    const updated: Identity = {
      userId: ctx.identity.userId,
      displayName: assertDisplayName(trimmed),
      socketId: socket.id,
    };
    room.removeMember(socket.id);
    room.addMember(socket.id, updated);
    ctx.identity = updated;
    deps.presenceBroadcaster.onJoin(ctx.roomId, room);
  } catch (caught) {
    if (!(caught instanceof InvalidPayloadError)) {
      throw caught;
    }
    deps.logger.warn('socket-handlers.refresh-name-invalid', {
      message: 'refresh-token name claim invalid as displayName, keeping old',
    });
  }
}

/** `AUTH_REFRESH_TOKEN`: swaps the session's claims and re-arms the expiry timers against the new exp. */
export function registerTokenRefreshHandler(
  socket: Socket,
  room: Room,
  deps: TokenRefreshDeps
): void {
  registerAckHandler<IRefreshTokenAck>(
    socket,
    AUTH_REFRESH_TOKEN,
    deps.logger,
    async (raw, ack) => {
      const ctx = readContext(socket);
      try {
        if (ctx === null || ctx.claims === null || ctx.tokenLifecycle === null) {
          // Anonymous handshakes never present a token — there is nothing to refresh.
          ack({ ok: false, error: 'auth/invalid-token' });
          return;
        }
        const payload = parseRefreshTokenPayload(raw);
        const result = await deps.connectionLifecycle.onRefresh(ctx.claims, payload.token);
        if (!result.ok) {
          deps.metrics.counters.tokenRefreshTotal.inc({ outcome: result.error });
          ack({ ok: false, error: result.error });
          return;
        }
        const newClaims = result.value;
        ctx.claims = newClaims;
        ctx.tokenLifecycle.replaceClaims(
          newClaims,
          buildTokenLifecycleCallbacks(socket, deps.transport)
        );
        renameIfChanged(socket, room, newClaims.name, deps);
        deps.metrics.counters.tokenRefreshTotal.inc({ outcome: 'ok' });
        // v2: a refreshed token implies the session continues, so the client is
        // hinted to refresh its TURN credentials and restart ICE mid-call.
        deps.transport.emitTurnCredentialsRenewed(socket.id);
        ack({
          ok: true,
          expiresAt: Temporal.Instant.fromEpochMilliseconds(newClaims.exp).toString(),
        });
      } catch (caught) {
        deps.logger.warn('socket-handlers.refresh-failed', {
          message: caught instanceof Error ? caught.message : String(caught),
        });
        ack({ ok: false, error: 'auth/invalid-token' });
      }
    }
  );
}
