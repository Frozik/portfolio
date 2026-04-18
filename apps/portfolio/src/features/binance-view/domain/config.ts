import type { Milliseconds } from '@frozik/utils';

import {
  FLUSH_EVERY_SNAPSHOTS,
  MAX_SEQUENCE_GAP_RETRIES,
  RECONNECT_DELAY_MS,
  SNAPSHOTS_PER_BLOCK,
} from './constants';
import type { IBinanceConfig } from './types';

export const BINANCE_CONFIG: IBinanceConfig = {
  instrument: 'BTCUSDT',
  rawDepth: 800,
  aggregatedDepth: 64,
  aggregationQuoteStep: 1.5,
  updateSpeedMs: 1000 as Milliseconds,
  streamHost: 'wss://stream.binance.com:9443',
  apiHost: 'https://api.binance.com/api/v3',
  restSnapshotLimit: 5000,
  snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
  flushEverySnapshots: FLUSH_EVERY_SNAPSHOTS,
  maxSequenceGapRetries: MAX_SEQUENCE_GAP_RETRIES,
  reconnectDelayMs: RECONNECT_DELAY_MS,
  fallbackPriceStep: 0.01,
};
