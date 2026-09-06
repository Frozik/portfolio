import { TURN_REQUEST_CREDENTIALS } from '@frozik/communication-protocol/events';
import type { ITurnCredentialsAck } from '@frozik/communication-protocol/messages';
import { MS_PER_MINUTE } from '@frozik/utils/date/constants';
import type { Socket } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import type { IServerConfig } from '../application/config/server-config-schema';
import { hashUserId } from '../application/hashUserId';
import { issueTurnCredentials } from '../application/IssueTurnCredentialsUseCase';
import type { IServerLogger } from '../application/ports/IServerLogger';
import { registerAckHandler } from './ack-handler';
import type { CommunicationMetrics } from './metrics';
import type { SocketContextData } from './socket-context';

type TurnCredentialsAck = ITurnCredentialsAck | { ok: false; error: string };

/**
 * `TURN_REQUEST_CREDENTIALS`: mints time-limited TURN credentials, at most a
 * few per minute per socket. Anonymous sessions get a shorter relay window:
 * relay traffic is the costliest resource and an anonymous identity is free to
 * mint, so the abuse window stays narrow while optional-auth calls can still
 * traverse symmetric NATs.
 */
export function registerTurnCredentialsHandler(
  socket: Socket,
  ctx: SocketContextData,
  turn: IServerConfig['turn'],
  logger: IServerLogger,
  metrics: CommunicationMetrics
): void {
  registerAckHandler<TurnCredentialsAck>(socket, TURN_REQUEST_CREDENTIALS, logger, (_raw, ack) => {
    const nowMs = Temporal.Now.instant().epochMilliseconds;
    if (nowMs - ctx.turnCredsBucket.windowStartMs > MS_PER_MINUTE) {
      ctx.turnCredsBucket = { count: 0, windowStartMs: nowMs };
    }
    if (ctx.turnCredsBucket.count >= turn.credential_requests_per_minute_per_socket) {
      ack({ ok: false, error: 'rate-limited' });
      return;
    }
    ctx.turnCredsBucket.count += 1;

    const creds = issueTurnCredentials({
      userIdHash: hashUserId(ctx.identity.userId),
      sharedSecret: turn.shared_secret,
      ttlSec: ctx.claims === null ? turn.anonymous_ttl_seconds : turn.ttl_seconds,
      urls: turn.urls,
      nowMs,
    });
    metrics.counters.turnCredentialsIssuedTotal.inc();
    ack(creds);
  });
}
