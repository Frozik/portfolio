import type { Milliseconds } from '@frozik/utils/date/types';
import type { Opaque } from '@frozik/utils/types/base';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import type { InstrumentSymbol } from './instruments';

export type UnixTimeMs = Opaque<'UnixTimeMs', number>;

export interface IOrderbookSnapshot {
  readonly eventTimeMs: UnixTimeMs;
  readonly bids: ReadonlyArray<readonly [price: number, volume: number]>;
  readonly asks: ReadonlyArray<readonly [price: number, volume: number]>;
}

/**
 * Snapshot emitted by the second-aligned quantizer. `isInterpolated` is
 * true when the bucket produced no live data and we repeated the previous
 * snapshot to avoid vertical gaps on the heatmap.
 */
export interface IQuantizedSnapshot extends IOrderbookSnapshot {
  readonly isInterpolated: boolean;
}

/** Metadata for a single orderbook block (128 snapshots × 128 levels). */
export interface IBlockMeta {
  readonly blockId: UnixTimeMs;
  readonly firstTimestampMs: UnixTimeMs;
  readonly lastTimestampMs: UnixTimeMs;
  readonly count: number;
}

export interface ITextureLayoutConfig {
  readonly textureWidth: number;
  readonly rowsPerBlock: number;
  readonly snapshotsPerRow: number;
}

export interface IHeatmapViewport {
  viewTimeEndMs: UnixTimeMs;
  targetViewTimeEndMs: UnixTimeMs;
  panVelocityMsPerFrame: number;
  priceMin: number;
  priceMax: number;
}

export interface IHitTestResult {
  readonly blockId: UnixTimeMs;
  readonly timestampMs: UnixTimeMs;
  readonly price: number;
  readonly volume: number;
  readonly side: 'bid' | 'ask' | 'padding';
  readonly pointerPx: { readonly x: number; readonly y: number };
}

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Whether flushed blocks reach IndexedDB. The first write or open failure
 * disables persistence for the rest of the session — the chart keeps running
 * from RAM and the status popup shows why history will not survive a reload.
 */
export type PersistenceState =
  | { readonly status: 'persisting' }
  | { readonly status: 'disabled'; readonly reason: ValueDescriptorFail };

export interface IBinanceConfig {
  readonly instrument: InstrumentSymbol;
  /** Raw levels per side taken from the full Binance order book. */
  readonly rawDepth: number;
  /** Price bins per side placed into the heatmap column (≤ `SNAPSHOT_SLOTS / 2`). */
  readonly aggregatedDepth: number;
  /** Aggregation bin size in the quote currency (USD for BTCUSDT). */
  readonly aggregationQuoteStep: number;
  readonly updateSpeedMs: Milliseconds;
  readonly streamHost: string;
  readonly apiHost: string;
  readonly restSnapshotLimit: number;
  readonly snapshotsPerBlock: number;
  readonly flushEverySnapshots: number;
  readonly maxSequenceGapRetries: number;
  readonly reconnectDelayMs: Milliseconds;
}
