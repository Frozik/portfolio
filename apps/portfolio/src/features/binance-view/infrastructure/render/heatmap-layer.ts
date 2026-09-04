import { isNil } from 'lodash-es';

import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from '../../domain/block-store/create-heatmap-block-index';
import {
  HEATMAP_ALPHA_UNDER_CANDLES,
  INITIAL_GPU_BLOCKS,
  MAX_GPU_BLOCKS,
  SNAPSHOT_SLOTS,
} from '../../domain/constants';
import type { IBlockFlushEvent } from '../../domain/flush-events';
import type { ITextureLayoutConfig, UnixTimeMs } from '../../domain/types';

import type { IHeatmapLayerResources, IVisibleBlock } from './heatmap-buffers';
import {
  createHeatmapBindGroup,
  createHeatmapResources,
  HEATMAP_VERTEX_COUNT_PER_INSTANCE,
  writeBlockDescriptors,
  writeHeatmapUniforms,
} from './heatmap-buffers';
import type { ILayerFrameContext, IRenderLayer } from './layer';
import { TextureRowManager } from './texture-row-manager';

type HeatmapBlockRegistry = BlockSpatialIndex<IHeatmapBlockIndexItem>;

export interface IHeatmapLayerParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly pipeline: GPURenderPipeline;
  readonly layout: ITextureLayoutConfig;
  readonly registry: HeatmapBlockRegistry;
}

/** Everything derived in `computeFrameState`; absent when no block is visible. */
interface IHeatmapFrameState {
  readonly visibleBlocks: ReadonlyArray<IVisibleBlock>;
  readonly globalBaseTimeMs: UnixTimeMs;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly plotHeightPx: number;
  readonly alphaMultiplier: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly timeStepMs: number;
  readonly priceStep: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly magnitudeMin: number;
  readonly magnitudeMax: number;
}

/** Orderbook cell-intensity layer: owns the data texture rows and the block descriptors. */
export class HeatmapLayer implements IRenderLayer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly registry: HeatmapBlockRegistry;
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly textureRowManager: TextureRowManager;
  private readonly resources: IHeatmapLayerResources;
  private bindGroup: GPUBindGroup;

  private frameState: IHeatmapFrameState | undefined = undefined;
  private totalInstances = 0;

  constructor(params: IHeatmapLayerParams) {
    this.device = params.device;
    this.pipeline = params.pipeline;
    this.registry = params.registry;
    this.bindGroupLayout = params.bindGroupLayout;
    this.resources = createHeatmapResources(params.device, MAX_GPU_BLOCKS);

    this.textureRowManager = new TextureRowManager({
      device: params.device,
      layout: params.layout,
      initialBlocks: INITIAL_GPU_BLOCKS,
      maxBlocks: MAX_GPU_BLOCKS,
      onEvict: this.markEvicted,
      onTextureRecreated: this.rebuildBindGroup,
    });

    this.bindGroup = this.createBindGroup();
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.textureRowManager.release(blockId);
  }

  /** Uploads the flushed snapshots to the data texture and upserts the block's registry entry. */
  writeFlushedSnapshots(event: IBlockFlushEvent): void {
    const meta = event.block;
    const slotIndex = this.textureRowManager.allocate(meta.blockId);

    const firstSnapshotIndex = meta.count - event.addedSnapshots;
    const floatsPerSnapshot = SNAPSHOT_SLOTS * 4;

    this.textureRowManager.writeSnapshots(
      slotIndex,
      firstSnapshotIndex,
      event.addedSnapshots,
      event.data,
      firstSnapshotIndex * floatsPerSnapshot
    );

    this.registry.upsert({
      minX: meta.firstTimestampMs,
      maxX: meta.lastTimestampMs,
      minY: 0,
      maxY: 0,
      blockId: meta.blockId,
      textureRowIndex: slotIndex,
      count: meta.count,
    });
  }

  computeFrameState(context: ILayerFrameContext): void {
    const { frameInput } = context;
    const visibleBlocks = this.collectVisibleBlocks(
      frameInput.viewTimeStartMs,
      frameInput.viewTimeEndMs
    );
    const firstBlock = visibleBlocks[0];

    if (isNil(firstBlock)) {
      this.frameState = undefined;
      this.totalInstances = 0;
      return;
    }

    const globalBaseTimeMs = firstBlock.meta.firstTimestampMs;

    this.frameState = {
      visibleBlocks,
      globalBaseTimeMs,
      canvasWidth: context.canvasWidthPx,
      canvasHeight: context.canvasHeightPx,
      plotWidthPx: context.plotWidthPx,
      plotHeightPx: context.plotHeightPx,
      alphaMultiplier: context.dimHeatmap ? HEATMAP_ALPHA_UNDER_CANDLES : 1,
      viewTimeStartDeltaMs: frameInput.viewTimeStartMs - globalBaseTimeMs,
      viewTimeEndDeltaMs: frameInput.viewTimeEndMs - globalBaseTimeMs,
      timeStepMs: frameInput.timeStepMs,
      priceStep: frameInput.priceStep,
      priceMin: frameInput.priceMin,
      priceMax: frameInput.priceMax,
      magnitudeMin: frameInput.magnitudeMin,
      magnitudeMax: frameInput.magnitudeMax,
    };
  }

  writeGpuResources(): void {
    const frameState = this.frameState;
    if (isNil(frameState)) {
      this.totalInstances = 0;
      return;
    }

    const result = writeBlockDescriptors(
      this.device,
      this.resources.descriptorsBuffer,
      frameState.visibleBlocks,
      frameState.globalBaseTimeMs
    );
    this.totalInstances = result.totalInstances;

    writeHeatmapUniforms(this.device, this.resources.uniformsBuffer, {
      ...frameState,
      blockCount: frameState.visibleBlocks.length,
    });
  }

  recordDrawCalls(pass: GPURenderPassEncoder): void {
    if (this.totalInstances === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(HEATMAP_VERTEX_COUNT_PER_INSTANCE, this.totalInstances, 0, 0);
  }

  dispose(): void {
    this.textureRowManager.dispose();
    this.resources.uniformsBuffer.destroy();
    this.resources.descriptorsBuffer.destroy();
  }

  private createBindGroup(): GPUBindGroup {
    return createHeatmapBindGroup(
      this.device,
      this.bindGroupLayout,
      this.resources,
      this.textureRowManager.createView()
    );
  }

  private readonly rebuildBindGroup = (): void => {
    this.bindGroup = this.createBindGroup();
  };

  private readonly markEvicted = (blockId: UnixTimeMs): void => {
    const item = this.registry.findByBlockId(blockId);
    if (!isNil(item)) {
      this.registry.upsert({ ...item, textureRowIndex: undefined });
    }
  };

  /** Blocks intersecting the viewport that are resident on the GPU; touching them pins them in the LRU. */
  private collectVisibleBlocks(viewStartMs: UnixTimeMs, viewEndMs: UnixTimeMs): IVisibleBlock[] {
    const visible: IVisibleBlock[] = [];
    for (const item of this.registry.searchRange(viewStartMs, viewEndMs)) {
      if (isNil(item.textureRowIndex)) {
        continue;
      }
      this.textureRowManager.touch(item.blockId);
      visible.push({
        meta: {
          blockId: item.blockId,
          firstTimestampMs: item.minX as UnixTimeMs,
          lastTimestampMs: item.maxX as UnixTimeMs,
          count: item.count,
        },
        textureRowIndex: item.textureRowIndex,
      });
    }
    return visible;
  }
}
