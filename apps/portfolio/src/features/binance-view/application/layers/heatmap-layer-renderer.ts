import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from '../../domain/block-store/create-heatmap-block-index';
import { INITIAL_GPU_BLOCKS, MAX_GPU_BLOCKS, SNAPSHOT_SLOTS } from '../../domain/constants';
import type { IBlockFlushEventBridge } from '../../domain/flush-bridge';
import { plotWidthDevicePx } from '../../domain/math';
import type { ITextureLayoutConfig, UnixTimeMs } from '../../domain/types';
import type { IHeatmapLayerResources, IVisibleBlock } from '../../infrastructure/heatmap-layer';
import {
  createHeatmapBindGroup,
  createHeatmapResources,
  HEATMAP_VERTEX_COUNT_PER_INSTANCE,
  writeBlockDescriptors,
  writeHeatmapUniforms,
} from '../../infrastructure/heatmap-layer';
import { TextureRowManager } from '../../infrastructure/texture-row-manager';
import type { ILayerFrameContext, ILayerRenderer } from './layer-renderer';

type HeatmapBlockRegistry = BlockSpatialIndex<IHeatmapBlockIndexItem>;

export interface IHeatmapLayerRendererParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly pipeline: GPURenderPipeline;
  readonly layout: ITextureLayoutConfig;
  readonly registry: HeatmapBlockRegistry;
}

/**
 * Per-frame state captured during {@link HeatmapLayerRenderer.computeFrameState}
 * and consumed by {@link HeatmapLayerRenderer.writeGpuResources}. Stored
 * as a single nullable field instead of multiple instance properties so
 * the layer's render-phase invariants stay obvious — either every
 * derived value is set together (visible-blocks branch) or `null` (no
 * blocks visible this frame, draw is skipped).
 */
interface IHeatmapFrameState {
  readonly visibleBlocks: ReadonlyArray<IVisibleBlock>;
  readonly globalBaseTimeMs: UnixTimeMs;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly timeStepMs: number;
  readonly priceStep: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly magnitudeMin: number;
  readonly magnitudeMax: number;
}

/**
 * Heatmap layer renderer — encapsulates the GPU resources, texture row
 * manager and per-frame compute / upload / draw lifecycle for the
 * orderbook cell-intensity layer.
 *
 * The orchestrator ({@link BinanceChartRenderer}) owns the canvas /
 * queue / MSAA / render-target pool and drives this layer through the
 * three-phase {@link ILayerRenderer} contract — observable reads happen
 * only in `computeFrameState`, GPU buffer writes happen only in
 * `writeGpuResources`, and draw calls happen only in `recordDrawCalls`.
 *
 * The layer also exposes orchestrator-side helpers
 * ({@link HeatmapLayerRenderer.releaseBlockSlot},
 * {@link HeatmapLayerRenderer.writeFlushedSnapshots}) — these are
 * driven by {@link BinanceChartState} when new orderbook flush events
 * arrive or older blocks roll out of the IDB rolling window.
 */
export class HeatmapLayerRenderer implements ILayerRenderer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly registry: HeatmapBlockRegistry;
  private readonly textureRowManager: TextureRowManager;
  private readonly resources: IHeatmapLayerResources;
  private readonly bindGroup: GPUBindGroup;

  private frameState: IHeatmapFrameState | null = null;
  private totalInstances = 0;

  constructor(params: IHeatmapLayerRendererParams) {
    this.device = params.device;
    this.pipeline = params.pipeline;
    this.registry = params.registry;

    this.textureRowManager = new TextureRowManager({
      device: params.device,
      layout: params.layout,
      initialBlocks: INITIAL_GPU_BLOCKS,
      maxBlocks: MAX_GPU_BLOCKS,
      onEvict: (blockId: UnixTimeMs) => {
        const item = this.registry.findByBlockId(blockId);
        if (item !== undefined) {
          item.textureRowIndex = undefined;
        }
      },
    });

    this.resources = createHeatmapResources(params.device, MAX_GPU_BLOCKS);
    this.bindGroup = createHeatmapBindGroup(
      params.device,
      params.bindGroupLayout,
      this.resources,
      this.textureRowManager.createView()
    );
  }

  /**
   * Release the GPU texture slot held by `blockId` — invoked by the
   * orchestrator when the IDB rolling window evicts a block. The
   * texture row manager pushes the freed slot onto its free list for
   * reuse on the next allocation.
   */
  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.textureRowManager.release(blockId);
  }

  /**
   * Upload newly accumulated snapshots to the GPU data texture and
   * upsert the corresponding entry in the spatial index. Called by the
   * orchestrator on every accumulator flush.
   */
  writeFlushedSnapshots(event: IBlockFlushEventBridge): void {
    const meta = event.block;
    const slotIndex = this.textureRowManager.allocate(meta.blockId);
    meta.textureRowIndex = slotIndex;

    const firstSnapshotIndex = meta.count - event.addedSnapshots;
    const floatsPerSnapshot = SNAPSHOT_SLOTS * 4;
    const dataOffsetFloats = firstSnapshotIndex * floatsPerSnapshot;

    this.textureRowManager.writeSnapshots(
      slotIndex,
      firstSnapshotIndex,
      event.addedSnapshots,
      event.data,
      dataOffsetFloats
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

  computeFrameState(ctx: ILayerFrameContext): void {
    const visibleBlocks = this.collectVisibleBlocks(
      ctx.frameInput.viewTimeStartMs,
      ctx.frameInput.viewTimeEndMs
    );

    if (visibleBlocks.length === 0) {
      this.frameState = null;
      this.totalInstances = 0;
      return;
    }

    const globalBaseTimeMs = visibleBlocks[0].meta.firstTimestampMs;
    const plotWidthPx = plotWidthDevicePx(ctx.canvasWidthPx, ctx.devicePixelRatio);

    this.frameState = {
      visibleBlocks,
      globalBaseTimeMs,
      canvasWidth: ctx.canvasWidthPx,
      canvasHeight: ctx.canvasHeightPx,
      plotWidthPx,
      viewTimeStartDeltaMs: ctx.frameInput.viewTimeStartMs - globalBaseTimeMs,
      viewTimeEndDeltaMs: ctx.frameInput.viewTimeEndMs - globalBaseTimeMs,
      timeStepMs: ctx.frameInput.timeStepMs,
      priceStep: ctx.frameInput.priceStep,
      priceMin: ctx.frameInput.priceMin,
      priceMax: ctx.frameInput.priceMax,
      magnitudeMin: ctx.frameInput.magnitudeMin,
      magnitudeMax: ctx.frameInput.magnitudeMax,
    };
  }

  writeGpuResources(_encoder: GPUCommandEncoder, _queue: GPUQueue): void {
    if (this.frameState === null) {
      this.totalInstances = 0;
      return;
    }

    const result = writeBlockDescriptors(
      this.device,
      this.resources.descriptorsBuffer,
      this.frameState.visibleBlocks,
      this.frameState.globalBaseTimeMs
    );
    this.totalInstances = result.totalInstances;

    writeHeatmapUniforms(this.device, this.resources.uniformsBuffer, {
      canvasWidth: this.frameState.canvasWidth,
      canvasHeight: this.frameState.canvasHeight,
      plotWidthPx: this.frameState.plotWidthPx,
      viewTimeStartDeltaMs: this.frameState.viewTimeStartDeltaMs,
      viewTimeEndDeltaMs: this.frameState.viewTimeEndDeltaMs,
      timeStepMs: this.frameState.timeStepMs,
      priceStep: this.frameState.priceStep,
      priceMin: this.frameState.priceMin,
      priceMax: this.frameState.priceMax,
      magnitudeMin: this.frameState.magnitudeMin,
      magnitudeMax: this.frameState.magnitudeMax,
      blockCount: this.frameState.visibleBlocks.length,
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

  /**
   * Visit every block whose time range intersects the viewport and
   * return only those still resident on the GPU texture. Touching the
   * texture-row LRU here keeps actively-rendered blocks pinned while
   * off-screen blocks decay toward eviction.
   */
  private collectVisibleBlocks(viewStartMs: UnixTimeMs, viewEndMs: UnixTimeMs): IVisibleBlock[] {
    const hits = this.registry.searchRange(viewStartMs, viewEndMs);
    const visible: IVisibleBlock[] = [];
    for (const item of hits) {
      if (item.textureRowIndex === undefined) {
        continue;
      }
      this.textureRowManager.touch(item.blockId);
      visible.push({
        meta: {
          blockId: item.blockId,
          firstTimestampMs: item.minX as UnixTimeMs,
          lastTimestampMs: item.maxX as UnixTimeMs,
          count: item.count,
          textureRowIndex: item.textureRowIndex,
        },
        textureRowIndex: item.textureRowIndex,
      });
    }
    return visible;
  }
}
