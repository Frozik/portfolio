import type { Milliseconds, Opaque } from '@frozik/utils';

export type UnixTimeMs = Opaque<'UnixTimeMs', number>;

export interface IOrderbookLevel {
  readonly price: number;
  readonly volume: number;
}

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

/**
 * Metadata for a single orderbook block (128 snapshots × 128 levels).
 *
 * `textureRowIndex` is `undefined` when the block has been LRU-evicted
 * from the GPU texture; data remains in IndexedDB and can be reloaded.
 */
export interface IBlockMeta {
  readonly blockId: UnixTimeMs;
  readonly firstTimestampMs: UnixTimeMs;
  lastTimestampMs: UnixTimeMs;
  count: number;
  textureRowIndex: number | undefined;
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

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'unsupported';

export interface IBinanceViewState {
  connection: ConnectionState;
  instrument: string;
  priceStep: number | undefined;
  pageOpenTimeMs: UnixTimeMs | undefined;
  lastDisplaySnapshotTimeMs: UnixTimeMs | undefined;
  snapshotsReceivedCount: number;
  errorMessage: string | undefined;
  hoveredCell: IHitTestResult | undefined;
}

export interface IBinanceConfig {
  readonly instrument: string;
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
  readonly fallbackPriceStep: number;
}
