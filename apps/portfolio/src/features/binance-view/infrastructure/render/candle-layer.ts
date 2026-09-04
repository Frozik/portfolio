import { isNil } from 'lodash-es';

import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import { FLOATS_PER_CANDLE, TEXELS_PER_CANDLE } from '../../domain/candle-encoding';
import type { ICandleBlockIndexItem, ICandleBlockRecord } from '../../domain/candle-types';
import {
  CANDLE_BODY_WIDTH_RATIO,
  CANDLE_MIN_BODY_HEIGHT_PX,
  CANDLE_WICK_WIDTH_PX,
  MAX_CANDLE_HISTORY_BLOCKS,
  MOVING_AVERAGE_LINE_WIDTH_PX,
  PIXELS_PER_MILLISECOND,
} from '../../domain/constants';
import type { ICandleFlushEvent } from '../../domain/flush-events';
import type { UnixTimeMs } from '../../domain/types';
import type { BlockTextureSlotManager } from '../block-store/block-texture-slot-manager';
import { createCandleSlotManager } from '../block-store/create-candle-slot-manager';

import type { ICandleLayerResources, ICandleVisibleBlock } from './candle-buffers';
import {
  CANDLE_VERTEX_COUNT_PER_INSTANCE,
  createCandleBindGroup,
  createCandleResources,
  writeCandleBlockDescriptors,
  writeCandleUniforms,
} from './candle-buffers';
import type { ILayerFrameContext, IRenderLayer } from './layer';

type CandleBlockIndex = BlockSpatialIndex<ICandleBlockIndexItem>;

const CANDLE_DURATION_MS = 1000;

export interface ICandleLayerParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly candlePipeline: GPURenderPipeline;
  readonly movingAverageShortPipeline: GPURenderPipeline;
  readonly movingAverageLongPipeline: GPURenderPipeline;
  readonly candleIndex: CandleBlockIndex;
  /** Visible blocks whose texture slot was evicted; the owner reloads them from IndexedDB. */
  readonly requestBlocks: (blockIds: readonly UnixTimeMs[]) => void;
}

interface ICandleFrameState {
  readonly visibleBlocks: ReadonlyArray<ICandleVisibleBlock>;
  readonly globalBaseTimeMs: UnixTimeMs;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly plotHeightPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly devicePixelRatio: number;
}

/**
 * One-second candles with the MA5 / MA10 lines drawn over them. Blocks live in a small
 * LRU texture; a visible block that has lost its slot is reported through
 * `requestBlocks` and comes back via {@link restoreBlock}.
 */
export class CandleLayer implements IRenderLayer {
  private readonly device: GPUDevice;
  private readonly candlePipeline: GPURenderPipeline;
  private readonly movingAverageShortPipeline: GPURenderPipeline;
  private readonly movingAverageLongPipeline: GPURenderPipeline;
  private readonly candleIndex: CandleBlockIndex;
  private readonly requestBlocks: (blockIds: readonly UnixTimeMs[]) => void;
  private readonly slots: BlockTextureSlotManager<UnixTimeMs>;
  private readonly resources: ICandleLayerResources;
  private readonly bindGroup: GPUBindGroup;

  private frameState: ICandleFrameState | undefined = undefined;
  private totalCandles = 0;

  constructor(params: ICandleLayerParams) {
    this.device = params.device;
    this.candlePipeline = params.candlePipeline;
    this.movingAverageShortPipeline = params.movingAverageShortPipeline;
    this.movingAverageLongPipeline = params.movingAverageLongPipeline;
    this.candleIndex = params.candleIndex;
    this.requestBlocks = params.requestBlocks;

    this.slots = createCandleSlotManager({ device: params.device, onEvict: this.markEvicted });
    this.resources = createCandleResources(params.device, MAX_CANDLE_HISTORY_BLOCKS);
    this.bindGroup = createCandleBindGroup(
      params.device,
      params.bindGroupLayout,
      this.resources,
      this.slots.textureView
    );
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.slots.free(blockId);
  }

  /** Uploads the candles added since the previous flush and upserts the block's index entry. */
  ingestFlush(event: ICandleFlushEvent): void {
    const meta = event.block;
    const slotIndex = this.slots.allocate(meta.blockId);
    const firstCandleIndex = meta.count - event.addedCandles;
    this.writeCandles(slotIndex, firstCandleIndex, event.addedCandles, event.data);
    this.candleIndex.upsert({
      minX: meta.firstBucketStartMs,
      maxX: meta.lastBucketStartMs,
      minY: 0,
      maxY: 0,
      blockId: meta.blockId,
      textureRowIndex: slotIndex,
      firstBucketStartMs: meta.firstBucketStartMs,
      lastBucketStartMs: meta.lastBucketStartMs,
      basePrice: meta.basePrice,
      count: meta.count,
    });
  }

  /** Re-uploads a whole persisted block into a fresh slot. */
  restoreBlock(record: ICandleBlockRecord): void {
    const slotIndex = this.slots.allocate(record.blockId);
    this.writeCandles(slotIndex, 0, record.count, new Float32Array(record.data));
    this.candleIndex.upsert({
      minX: record.firstBucketStartMs,
      maxX: record.lastBucketStartMs,
      minY: 0,
      maxY: 0,
      blockId: record.blockId,
      textureRowIndex: slotIndex,
      firstBucketStartMs: record.firstBucketStartMs,
      lastBucketStartMs: record.lastBucketStartMs,
      basePrice: record.basePrice,
      count: record.count,
    });
  }

  computeFrameState(context: ILayerFrameContext): void {
    const { frameInput } = context;
    const { visible, missing } = this.collectVisibleBlocks(
      frameInput.viewTimeStartMs,
      frameInput.viewTimeEndMs
    );
    if (missing.length > 0) {
      this.requestBlocks(missing);
    }
    const firstBlock = visible[0];
    if (isNil(firstBlock)) {
      this.frameState = undefined;
      this.totalCandles = 0;
      return;
    }

    const globalBaseTimeMs = firstBlock.item.firstBucketStartMs;
    this.frameState = {
      visibleBlocks: visible,
      globalBaseTimeMs,
      canvasWidth: context.canvasWidthPx,
      canvasHeight: context.canvasHeightPx,
      plotWidthPx: context.plotWidthPx,
      plotHeightPx: context.plotHeightPx,
      viewTimeStartDeltaMs: frameInput.viewTimeStartMs - globalBaseTimeMs,
      viewTimeEndDeltaMs: frameInput.viewTimeEndMs - globalBaseTimeMs,
      priceMin: frameInput.priceMin,
      priceMax: frameInput.priceMax,
      devicePixelRatio: context.devicePixelRatio,
    };
  }

  writeGpuResources(): void {
    const frameState = this.frameState;
    if (isNil(frameState)) {
      this.totalCandles = 0;
      return;
    }
    this.totalCandles = writeCandleBlockDescriptors(
      this.device,
      this.resources.descriptorsBuffer,
      frameState.visibleBlocks,
      frameState.globalBaseTimeMs
    );
    const { devicePixelRatio } = frameState;
    writeCandleUniforms(this.device, this.resources.uniformsBuffer, {
      ...frameState,
      candleWidthPx:
        CANDLE_DURATION_MS * PIXELS_PER_MILLISECOND * CANDLE_BODY_WIDTH_RATIO * devicePixelRatio,
      wickWidthPx: CANDLE_WICK_WIDTH_PX * devicePixelRatio,
      minBodyHeightPx: CANDLE_MIN_BODY_HEIGHT_PX * devicePixelRatio,
      lineWidthPx: MOVING_AVERAGE_LINE_WIDTH_PX * devicePixelRatio,
      blockCount: frameState.visibleBlocks.length,
    });
  }

  recordDrawCalls(pass: GPURenderPassEncoder): void {
    if (this.totalCandles === 0) {
      return;
    }
    pass.setBindGroup(0, this.bindGroup);
    pass.setPipeline(this.candlePipeline);
    pass.draw(CANDLE_VERTEX_COUNT_PER_INSTANCE, this.totalCandles, 0, 0);

    const segmentCount = this.totalCandles - 1;
    if (segmentCount <= 0) {
      return;
    }
    pass.setPipeline(this.movingAverageLongPipeline);
    pass.draw(CANDLE_VERTEX_COUNT_PER_INSTANCE, segmentCount, 0, 0);
    pass.setPipeline(this.movingAverageShortPipeline);
    pass.draw(CANDLE_VERTEX_COUNT_PER_INSTANCE, segmentCount, 0, 0);
  }

  dispose(): void {
    this.slots.dispose();
    this.resources.uniformsBuffer.destroy();
    this.resources.descriptorsBuffer.destroy();
  }

  private writeCandles(
    slotIndex: number,
    firstCandleIndex: number,
    candleCount: number,
    data: Float32Array
  ): void {
    if (candleCount <= 0) {
      return;
    }
    const firstFloat = firstCandleIndex * FLOATS_PER_CANDLE;
    const bytes = new Uint8Array(
      data.buffer,
      data.byteOffset + firstFloat * Float32Array.BYTES_PER_ELEMENT,
      candleCount * FLOATS_PER_CANDLE * Float32Array.BYTES_PER_ELEMENT
    );
    this.slots.writeRegion(
      slotIndex,
      firstCandleIndex * TEXELS_PER_CANDLE,
      bytes,
      candleCount * TEXELS_PER_CANDLE
    );
  }

  private readonly markEvicted = (blockId: UnixTimeMs): void => {
    const item = this.candleIndex.findByBlockId(blockId);
    if (!isNil(item)) {
      this.candleIndex.upsert({ ...item, textureRowIndex: undefined });
    }
  };

  private collectVisibleBlocks(
    viewStartMs: UnixTimeMs,
    viewEndMs: UnixTimeMs
  ): { readonly visible: ICandleVisibleBlock[]; readonly missing: UnixTimeMs[] } {
    const visible: ICandleVisibleBlock[] = [];
    const missing: UnixTimeMs[] = [];
    for (const item of this.candleIndex.searchRange(viewStartMs, viewEndMs)) {
      if (isNil(item.textureRowIndex)) {
        missing.push(item.blockId);
        continue;
      }
      this.slots.touch(item.blockId);
      visible.push({ item, textureOffset: this.slots.slotTextureOffset(item.textureRowIndex) });
    }
    return { visible, missing };
  }
}
