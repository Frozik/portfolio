import { isNil } from 'lodash-es';

import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import {
  PIXELS_PER_MILLISECOND,
  VOLUME_BAR_WIDTH_RATIO,
  VOLUME_BARS_CSS_PX,
} from '../../domain/constants';
import type { ITradeBlockFlushEvent } from '../../domain/flush-events';
import {
  BUCKET_DURATION_MS,
  FLOATS_PER_BUCKET,
  MAX_BUCKETS_PER_BLOCK,
  MAX_TRADE_BLOCKS_IN_RAM,
} from '../../domain/trades-constants';
import type { ITradeBlockIndexItem } from '../../domain/trades-types';
import type { UnixTimeMs } from '../../domain/types';

import type { ILayerFrameContext, IRenderLayer } from './layer';
import type { ITradesLayerResources, IVolumeBar } from './trades-buffers';
import {
  createTradesBindGroup,
  createTradesResources,
  VOLUME_BAR_VERTEX_COUNT_PER_INSTANCE,
  writeTradesUniforms,
  writeVolumeBarDescriptors,
} from './trades-buffers';

export interface ITradesLayerParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly volumeBarsPipeline: GPURenderPipeline;
  readonly tradesIndex: BlockSpatialIndex<ITradeBlockIndexItem>;
}

interface ITradesFrameState {
  readonly volumeBars: ReadonlyArray<IVolumeBar>;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly plotHeightPx: number;
  readonly viewTimeEndDeltaMs: number;
  readonly devicePixelRatio: number;
}

interface IDecodedBucket {
  readonly bucketStartMs: UnixTimeMs;
  readonly centerTimeDeltaMs: number;
  readonly volumeTotal: number;
  readonly buyFraction: number;
}

/**
 * Per-second trade volume as buy/sell stacks in the band under the price
 * area. Bar times are deltas anchored at the view start so the shader stays
 * in low-magnitude floats. Nothing of this layer is drawn over the price area.
 */
export class TradesLayer implements IRenderLayer {
  private readonly device: GPUDevice;
  private readonly volumeBarsPipeline: GPURenderPipeline;
  private readonly tradesIndex: BlockSpatialIndex<ITradeBlockIndexItem>;
  private readonly resources: ITradesLayerResources;
  private readonly bindGroup: GPUBindGroup;

  private readonly blockDataByBlockId = new Map<UnixTimeMs, Float32Array>();
  private frameState: ITradesFrameState | undefined = undefined;

  constructor(params: ITradesLayerParams) {
    this.device = params.device;
    this.volumeBarsPipeline = params.volumeBarsPipeline;
    this.tradesIndex = params.tradesIndex;
    this.resources = createTradesResources(
      params.device,
      MAX_TRADE_BLOCKS_IN_RAM * MAX_BUCKETS_PER_BLOCK
    );
    this.bindGroup = createTradesBindGroup(params.device, params.bindGroupLayout, this.resources);
  }

  ingestFlush(event: ITradeBlockFlushEvent): void {
    this.blockDataByBlockId.set(event.block.blockId, event.data);
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.blockDataByBlockId.delete(blockId);
  }

  computeFrameState(context: ILayerFrameContext): void {
    const { frameInput } = context;
    const decodedBuckets = this.decodeVisibleBuckets(context);
    if (decodedBuckets.length === 0) {
      this.frameState = undefined;
      return;
    }

    const maxVolume = Math.max(...decodedBuckets.map(bucket => bucket.volumeTotal));
    const volumeBars = decodedBuckets.map(bucket => ({
      centerTimeDeltaMs: bucket.centerTimeDeltaMs + BUCKET_DURATION_MS / 2,
      volumeFraction: maxVolume > 0 ? bucket.volumeTotal / maxVolume : 0,
      buyFraction: bucket.buyFraction,
      isHovered: bucket.bucketStartMs === frameInput.hoveredBucketKey,
    }));

    this.frameState = {
      volumeBars,
      canvasWidth: context.canvasWidthPx,
      canvasHeight: context.canvasHeightPx,
      plotWidthPx: context.plotWidthPx,
      plotHeightPx: context.plotHeightPx,
      viewTimeEndDeltaMs: frameInput.viewTimeEndMs - frameInput.viewTimeStartMs,
      devicePixelRatio: context.devicePixelRatio,
    };
  }

  writeGpuResources(): void {
    const frameState = this.frameState;
    if (isNil(frameState)) {
      return;
    }
    const { devicePixelRatio } = frameState;
    writeTradesUniforms(this.device, this.resources.uniformsBuffer, {
      ...frameState,
      viewTimeStartDeltaMs: 0,
      panelTopPx: frameState.plotHeightPx,
      panelHeightPx: VOLUME_BARS_CSS_PX * devicePixelRatio,
      barWidthPx:
        BUCKET_DURATION_MS * PIXELS_PER_MILLISECOND * VOLUME_BAR_WIDTH_RATIO * devicePixelRatio,
    });
    writeVolumeBarDescriptors(this.device, this.resources.volumeBarsBuffer, frameState.volumeBars);
  }

  /** Nothing over the price area; the panel is recorded through {@link recordVolumePanelDrawCalls}. */
  recordDrawCalls(): void {}

  /** Buy/sell volume stack per second, drawn into the band under the price area. */
  recordVolumePanelDrawCalls(pass: GPURenderPassEncoder): void {
    const frameState = this.frameState;
    if (isNil(frameState) || frameState.volumeBars.length === 0) {
      return;
    }
    pass.setPipeline(this.volumeBarsPipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VOLUME_BAR_VERTEX_COUNT_PER_INSTANCE, frameState.volumeBars.length, 0, 0);
  }

  dispose(): void {
    this.resources.uniformsBuffer.destroy();
    this.resources.volumeBarsBuffer.destroy();
    this.blockDataByBlockId.clear();
    this.frameState = undefined;
  }

  /** Buckets whose one-second slot overlaps the view, so a bar cut by the edge still shows. */
  private decodeVisibleBuckets(context: ILayerFrameContext): readonly IDecodedBucket[] {
    const { viewTimeStartMs, viewTimeEndMs } = context.frameInput;
    const searchFromMs = (viewTimeStartMs - BUCKET_DURATION_MS) as UnixTimeMs;
    const decoded: IDecodedBucket[] = [];

    for (const item of this.tradesIndex.searchRange(searchFromMs, viewTimeEndMs)) {
      const data = this.blockDataByBlockId.get(item.blockId);
      if (isNil(data)) {
        continue;
      }
      for (let bucketIndex = 0; bucketIndex < item.bucketCount; bucketIndex++) {
        const offset = bucketIndex * FLOATS_PER_BUCKET;
        const bucketStartMs = (item.minX + data[offset]) as UnixTimeMs;
        if (bucketStartMs < searchFromMs || bucketStartMs > viewTimeEndMs) {
          continue;
        }
        decoded.push({
          bucketStartMs,
          centerTimeDeltaMs: bucketStartMs - viewTimeStartMs,
          volumeTotal: data[offset + 2],
          buyFraction: data[offset + 3],
        });
      }
    }
    return decoded;
  }
}
