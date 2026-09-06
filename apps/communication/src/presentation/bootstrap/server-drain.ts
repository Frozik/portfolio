import type { FastifyInstance } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import type { RoomId } from '../../domain/types';
import type { SocketIORoomTransport } from '../../infrastructure/SocketIORoomTransport';
import type { CommunicationMetrics } from '../metrics';
import { readContext } from '../socket-context';

const DRAIN_POLL_INTERVAL_MS = 100;
const HTTP_SERVICE_UNAVAILABLE = 503;

export type DrainParams = {
  io: SocketIOServer;
  transport: SocketIORoomTransport;
  metrics: CommunicationMetrics;
  apps: readonly FastifyInstance[];
  /** Everything to let go of once the apps are down: the cert watcher, the Redis clients. */
  releaseResources: () => Promise<void>;
};

/** Warns every room once — `emitDraining` broadcasts to the whole room, so once per socket would duplicate. */
function announceDraining(io: SocketIOServer, transport: SocketIORoomTransport): void {
  const drainedRooms = new Set<RoomId>();
  for (const [, socket] of io.sockets.sockets) {
    const ctx = readContext(socket);
    if (ctx !== null && !drainedRooms.has(ctx.roomId)) {
      drainedRooms.add(ctx.roomId);
      transport.emitDraining(ctx.roomId);
    }
  }
}

async function waitForQuiet(
  io: SocketIOServer,
  metrics: CommunicationMetrics,
  windowMs: number
): Promise<void> {
  const drainStart = Temporal.Now.instant().epochMilliseconds;
  while (Temporal.Now.instant().epochMilliseconds - drainStart < windowMs) {
    const pending = await metrics.gauges.pendingCorrelations.get();
    const value = pending.values[0]?.value ?? 0;
    if (value === 0 && io.sockets.sockets.size === 0) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_INTERVAL_MS));
  }
}

function closeSocketServer(io: SocketIOServer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    io.close(error => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * The graceful shutdown: tell every room, refuse new upgrades, wait for the
 * in-flight dispatches and sockets to settle within the grace window, then
 * tear everything down. Idempotent — `close()` calls it and so may SIGTERM, and
 * the engine.io refuse-middleware must not be stacked on every call.
 */
export function createDrain({
  io,
  transport,
  metrics,
  apps,
  releaseResources,
}: DrainParams): (windowMs: number) => Promise<void> {
  let isRefusingUpgrades = false;

  return async (windowMs: number): Promise<void> => {
    announceDraining(io, transport);

    if (!isRefusingUpgrades) {
      io.engine.use(
        (_req: unknown, res: { writeHead: (status: number) => void; end: () => void }) => {
          res.writeHead(HTTP_SERVICE_UNAVAILABLE);
          res.end();
        }
      );
      isRefusingUpgrades = true;
    }

    await waitForQuiet(io, metrics, windowMs);

    for (const [, socket] of io.sockets.sockets) {
      socket.disconnect(true);
    }
    await closeSocketServer(io);
    for (const app of apps) {
      await app.close();
    }
    try {
      await releaseResources();
    } catch {
      // Cleanup errors during shutdown are non-fatal — Redis sockets may
      // already be closed by the time we reach this point.
    }
  };
}
