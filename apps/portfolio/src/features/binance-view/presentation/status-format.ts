import type { ConnectionState } from '../domain/types';

import { binanceT } from './translations';

export function statusLabel(connection: ConnectionState): string {
  switch (connection) {
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

export function statusBadgeClass(connection: ConnectionState): string {
  switch (connection) {
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

export function statusIconClass(connection: ConnectionState): string {
  switch (connection) {
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

export function isConnectionOffline(connection: ConnectionState): boolean {
  return connection === 'error' || connection === 'unsupported';
}
