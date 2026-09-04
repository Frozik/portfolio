import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import type { BlockSpatialIndex } from '../block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from '../block-store/create-heatmap-block-index';
import type { ICandleBlockIndexItem, ICandleBlockRecord } from '../candle-types';
import type { IBlockFlushEvent, ICandleFlushEvent, ITradeBlockFlushEvent } from '../flush-events';
import type { IRenderFrameInput } from '../render-frame-types';
import type { ITradeBlockIndexItem } from '../trades-types';
import type { UnixTimeMs } from '../types';

/**
 * The two stacked canvases of one chart: WebGPU draws the data into
 * `chartCanvas` (which also receives pointer input); `overlayCanvas` is a
 * transparent, pointer-transparent 2D layer above it for axis labels, the
 * price panel and the crosshair.
 */
export interface IChartCanvases {
  readonly chartCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
}

/**
 * Port for the chart renderer. The application layer feeds it flushed
 * blocks and a per-frame input; the GPU adapter lives in `infrastructure/render`.
 */
export interface IChartRenderer {
  start(): void;
  writeFlushedSnapshots(event: IBlockFlushEvent): void;
  writeFlushedCandles(event: ICandleFlushEvent): void;
  /** Re-uploads a block evicted from the GPU texture, from its persisted record. */
  restoreCandleBlock(record: ICandleBlockRecord): void;
  writeFlushedTrades(event: ITradeBlockFlushEvent): void;
  releaseBlockSlot(blockId: UnixTimeMs): void;
  releaseCandleBlockSlot(blockId: UnixTimeMs): void;
  releaseTradesBlockSlot(blockId: UnixTimeMs): void;
  dispose(): void;
}

export interface IChartRendererParams {
  readonly canvases: IChartCanvases;
  readonly registry: BlockSpatialIndex<IHeatmapBlockIndexItem>;
  readonly candleIndex: BlockSpatialIndex<ICandleBlockIndexItem>;
  readonly tradesIndex: BlockSpatialIndex<ITradeBlockIndexItem>;
  /** Subscribes the frame callback to the feature's frame scheduler; returns the unsubscribe. */
  readonly scheduleFrames: (renderFrame: () => void) => VoidFunction;
  readonly readFrameInput: () => IRenderFrameInput;
  /** Visible candle blocks whose texture slot was evicted; the owner reloads them from IndexedDB. */
  readonly requestCandleBlocks: (blockIds: readonly UnixTimeMs[]) => void;
}

export type ChartRendererInit =
  | { readonly kind: 'ready'; readonly renderer: IChartRenderer }
  | { readonly kind: 'unsupported'; readonly reason: ValueDescriptorFail };

export type CreateChartRenderer = (params: IChartRendererParams) => Promise<ChartRendererInit>;
