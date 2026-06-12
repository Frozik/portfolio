import type { Milliseconds } from '@frozik/utils/date/types';

import {
  FLUSH_EVERY_SNAPSHOTS,
  MAX_SEQUENCE_GAP_RETRIES,
  RECONNECT_DELAY_MS,
  SNAPSHOTS_PER_BLOCK,
} from './constants';
import { DEFAULT_INSTRUMENT } from './instruments';
import type { IBinanceConfig } from './types';

export const BINANCE_CONFIG: IBinanceConfig = {
  instrument: DEFAULT_INSTRUMENT.symbol,
  rawDepth: 800,
  aggregatedDepth: 64,
  aggregationQuoteStep: DEFAULT_INSTRUMENT.aggregationQuoteStep,
  updateSpeedMs: 1000 as Milliseconds,
  streamHost: 'wss://stream.binance.com:9443',
  apiHost: 'https://api.binance.com/api/v3',
  restSnapshotLimit: 5000,
  snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
  flushEverySnapshots: FLUSH_EVERY_SNAPSHOTS,
  maxSequenceGapRetries: MAX_SEQUENCE_GAP_RETRIES,
  reconnectDelayMs: RECONNECT_DELAY_MS,
};
