import type { ConnectionState } from '../domain/types';

import { binanceT } from './translations';

/** What the badge can show: a channel state, or WebGPU being unavailable on this device. */
export type BadgeStatus = ConnectionState | 'unsupported';

/** Severity rank, higher is worse; the badge shows the worst channel. */
const STATUS_RANK: Record<BadgeStatus, number> = {
  connected: 0,
  connecting: 1,
  idle: 2,
  disconnected: 3,
  error: 4,
  unsupported: 4,
};

function worseOf(left: BadgeStatus, right: BadgeStatus): BadgeStatus {
  return STATUS_RANK[right] > STATUS_RANK[left] ? right : left;
}

/**
 * A connected socket is not "alive" until the first REST snapshot has
 * landed, so the badge stays at least `connecting` until then.
 */
export function pickWorstStatus({
  connections,
  hasFirstSnapshot,
  failure,
}: {
  readonly connections: readonly ConnectionState[];
  readonly hasFirstSnapshot: boolean;
  readonly failure: 'webgpu' | 'instrument' | undefined;
}): BadgeStatus {
  if (failure === 'webgpu') {
    return 'unsupported';
  }
  if (failure === 'instrument') {
    return 'error';
  }
  const worst = connections.reduce<BadgeStatus>(worseOf, 'connected');
  return hasFirstSnapshot ? worst : worseOf(worst, 'connecting');
}

export function isConnectionOffline(status: BadgeStatus): boolean {
  return status !== 'connected' && status !== 'connecting';
}

export function statusLabel(status: BadgeStatus): string {
  switch (status) {
    case 'idle':
      return binanceT.status.idle;
    case 'connecting':
      return binanceT.status.connecting;
    case 'connected':
      return binanceT.status.connected;
    case 'disconnected':
      return binanceT.status.disconnected;
    case 'error':
      return binanceT.status.error;
    case 'unsupported':
      return binanceT.status.unsupported;
  }
}

export function statusBadgeClass(status: BadgeStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-success/20 text-success';
    case 'connecting':
      return 'bg-info/20 text-info animate-pulse';
    case 'disconnected':
      return 'bg-warning/20 text-warning';
    case 'error':
    case 'unsupported':
      return 'bg-error/20 text-error';
    case 'idle':
      return 'bg-surface-elevated text-text-muted';
  }
}

export function statusIconClass(status: BadgeStatus): string {
  switch (status) {
    case 'connected':
      return 'text-success';
    case 'connecting':
      return 'text-info animate-pulse';
    case 'disconnected':
      return 'text-warning';
    case 'error':
    case 'unsupported':
      return 'text-error';
    case 'idle':
      return 'text-text-muted';
  }
}
