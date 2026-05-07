import type { BlockSpatialIndex } from '../../domain/block-store/block-spatial-index';
import type { IMidPriceBlockIndexItem } from '../../domain/block-store/create-mid-price-block-index';
import { MAX_MID_PRICE_BLOCKS } from '../../domain/constants';
import { plotWidthDevicePx } from '../../domain/math';
import type { IMidPriceLayerResources, IMidPriceVisibleBlock } from '../../domain/mid-price-layer';
import {
  createMidPriceBindGroup,
  createMidPriceResources,
  MID_PRICE_VERTEX_COUNT_PER_INSTANCE,
  writeMidPriceBlockDescriptors,
  writeMidPriceUniforms,
} from '../../domain/mid-price-layer';
import { MidPriceTextureRowManager } from '../../domain/mid-price-texture-manager';
import type { IMidPriceFlushEventBridge } from '../../domain/render-frame-types';
import type { UnixTimeMs } from '../../domain/types';
import type { ILayerFrameContext, ILayerRenderer } from './layer-renderer';

type MidPriceBlockIndex = BlockSpatialIndex<IMidPriceBlockIndexItem>;

export interface IMidPriceLayerRendererParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly interiorPipeline: GPURenderPipeline;
  readonly outlinePipeline: GPURenderPipeline;
  readonly midPriceIndex: MidPriceBlockIndex;
}

/**
 * Per-frame state captured during {@link MidPriceLayerRenderer.computeFrameState}
 * and consumed by {@link MidPriceLayerRenderer.writeGpuResources}. Stored
 * as a single nullable field so the layer's render-phase invariants stay
 * obvious — either every derived value is set together (visible-blocks
 * branch) or `null` (no blocks visible this frame, draw is skipped).
 */
interface IMidPriceFrameState {
  readonly visibleBlocks: ReadonlyArray<IMidPriceVisibleBlock>;
  readonly globalBaseTimeMs: UnixTimeMs;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly priceMin: number;
  readonly priceMax: number;
}

/**
 * Mid-price line layer renderer — encapsulates the two pipelines
 * (outline + interior), GPU resources, texture row manager, and per-
 * frame compute / upload / draw lifecycle for the mid-price visual.
 *
 * The orchestrator ({@link BinanceChartRenderer}) drives this layer via
 * the three-phase {@link ILayerRenderer} contract — observable reads
 * happen only in `computeFrameState`, GPU buffer writes happen only in
 * `writeGpuResources`, and draw calls happen only in `recordDrawCalls`.
 *
 * Two draw calls are issued per frame in fixed order: outline first
 * (black annulus), then interior (coloured core). The interior pass
 * intentionally overwrites overlapping outline pixels so a later
 * turning-segment's outline can never "eat" an earlier segment's body.
 *
 * The layer also exposes orchestrator-side helpers
 * ({@link MidPriceLayerRenderer.releaseBlockSlot},
 * {@link MidPriceLayerRenderer.ingestFlush}) — these are driven by
 * {@link BinanceChartState} when new mid-price flush events arrive or
 * older blocks roll out of the IDB rolling window.
 */
export class MidPriceLayerRenderer implements ILayerRenderer {
  private readonly device: GPUDevice;
  private readonly interiorPipeline: GPURenderPipeline;
  private readonly outlinePipeline: GPURenderPipeline;
  private readonly midPriceIndex: MidPriceBlockIndex;
  private readonly textureRowManager: MidPriceTextureRowManager;
  private readonly resources: IMidPriceLayerResources;
  private readonly bindGroup: GPUBindGroup;

  private frameState: IMidPriceFrameState | null = null;
  private totalSegments = 0;

  constructor(params: IMidPriceLayerRendererParams) {
    this.device = params.device;
    this.interiorPipeline = params.interiorPipeline;
    this.outlinePipeline = params.outlinePipeline;
    this.midPriceIndex = params.midPriceIndex;

    this.textureRowManager = new MidPriceTextureRowManager({
      device: params.device,
      onEvict: (blockId: UnixTimeMs) => {
        const item = this.midPriceIndex.findByBlockId(blockId);
        if (item !== undefined) {
          item.textureRowIndex = undefined;
        }
      },
    });

    this.resources = createMidPriceResources(params.device, MAX_MID_PRICE_BLOCKS);
    this.bindGroup = createMidPriceBindGroup(
      params.device,
      params.bindGroupLayout,
      this.resources,
      this.textureRowManager.createView()
    );
  }

  /**
   * Release the GPU texture slot held by `blockId` — invoked by the
   * orchestrator when the IDB rolling window evicts a mid-price block.
   * The texture row manager pushes the freed slot onto its free list
   * for reuse on the next allocation.
   */
  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.textureRowManager.release(blockId);
  }

  /**
   * Upload new mid-price samples to the GPU texture and upsert the
   * corresponding entry into the mid-price index. `addedSamples` is
   * the count of samples written on the tail of the active block since
   * the previous flush.
   */
  ingestFlush(event: IMidPriceFlushEventBridge): void {
    const meta = event.block;
    const slotIndex = this.textureRowManager.allocate(meta.blockId);
    meta.textureRowIndex = slotIndex;

    const firstSampleIndex = meta.count - event.addedSamples;
    const floatsPerSample = 4;
    const dataOffsetFloats = firstSampleIndex * floatsPerSample;

    this.textureRowManager.writeSamples(
      slotIndex,
      firstSampleIndex,
      event.addedSamples,
      event.data,
      dataOffsetFloats
    );

    this.midPriceIndex.upsert({
      minX: meta.firstTimestampMs,
      maxX: meta.lastTimestampMs,
      minY: 0,
      maxY: 0,
      blockId: meta.blockId,
      firstTimestampMs: meta.firstTimestampMs,
      basePrice: meta.basePrice,
      lastTimestampMs: meta.lastTimestampMs,
      count: meta.count,
      textureRowIndex: slotIndex,
    });
  }

  computeFrameState(ctx: ILayerFrameContext): void {
    const visibleBlocks = this.collectVisibleBlocks(
      ctx.frameInput.viewTimeStartMs,
      ctx.frameInput.viewTimeEndMs
    );

    if (visibleBlocks.length === 0) {
      this.frameState = null;
      this.totalSegments = 0;
      return;
    }

    const globalBaseTimeMs = visibleBlocks[0].item.firstTimestampMs;
    const plotWidthPx = plotWidthDevicePx(ctx.canvasWidthPx, ctx.devicePixelRatio);

    this.frameState = {
      visibleBlocks,
      globalBaseTimeMs,
      canvasWidth: ctx.canvasWidthPx,
      canvasHeight: ctx.canvasHeightPx,
      plotWidthPx,
      viewTimeStartDeltaMs: ctx.frameInput.viewTimeStartMs - globalBaseTimeMs,
      viewTimeEndDeltaMs: ctx.frameInput.viewTimeEndMs - globalBaseTimeMs,
      priceMin: ctx.frameInput.priceMin,
      priceMax: ctx.frameInput.priceMax,
    };
  }

  writeGpuResources(_encoder: GPUCommandEncoder, _queue: GPUQueue): void {
    if (this.frameState === null) {
      this.totalSegments = 0;
      return;
    }

    const result = writeMidPriceBlockDescriptors(
      this.device,
      this.resources.descriptorsBuffer,
      this.frameState.visibleBlocks,
      this.frameState.globalBaseTimeMs
    );
    this.totalSegments = result.totalSegments;

    writeMidPriceUniforms(this.device, this.resources.uniformsBuffer, {
      canvasWidth: this.frameState.canvasWidth,
      canvasHeight: this.frameState.canvasHeight,
      plotWidthPx: this.frameState.plotWidthPx,
      viewTimeStartDeltaMs: this.frameState.viewTimeStartDeltaMs,
      viewTimeEndDeltaMs: this.frameState.viewTimeEndDeltaMs,
      priceMin: this.frameState.priceMin,
      priceMax: this.frameState.priceMax,
      blockCount: this.frameState.visibleBlocks.length,
    });
  }

  recordDrawCalls(pass: GPURenderPassEncoder): void {
    if (this.totalSegments === 0) {
      return;
    }
    pass.setBindGroup(0, this.bindGroup);

    // Pass A — outline. Stamps black annulus for every segment.
    // Adjacent outlines overlap harmlessly (black on black).
    pass.setPipeline(this.outlinePipeline);
    pass.draw(MID_PRICE_VERTEX_COUNT_PER_INSTANCE, this.totalSegments, 0, 0);

    // Pass B — interior. Coloured core of every segment overwrites
    // whatever outlines were stamped into its footprint, including
    // the outline of any other segment that happened to bleed in.
    // That's what stops a later turning-segment's outline from
    // sitting on top of an earlier segment's body.
    pass.setPipeline(this.interiorPipeline);
    pass.draw(MID_PRICE_VERTEX_COUNT_PER_INSTANCE, this.totalSegments, 0, 0);
  }

  dispose(): void {
    this.textureRowManager.dispose();
    this.resources.uniformsBuffer.destroy();
    this.resources.descriptorsBuffer.destroy();
  }

  /**
   * Collect mid-price blocks overlapping the visible window. Each
   * visible block is paired with the texture offset of its first sample
   * so the shader can `textureLoad` directly. Touching the texture-row
   * LRU here keeps actively-rendered blocks pinned while off-screen
   * blocks decay toward eviction.
   */
  private collectVisibleBlocks(
    viewStartMs: UnixTimeMs,
    viewEndMs: UnixTimeMs
  ): IMidPriceVisibleBlock[] {
    const hits = this.midPriceIndex.searchRange(viewStartMs, viewEndMs);
    const visible: IMidPriceVisibleBlock[] = [];
    for (const item of hits) {
      if (item.textureRowIndex === undefined) {
        continue;
      }
      this.textureRowManager.touch(item.blockId);
      visible.push({
        item,
        textureOffset: this.textureRowManager.slotTextureOffset(item.textureRowIndex),
      });
    }
    return visible;
  }
}
