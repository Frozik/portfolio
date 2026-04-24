import { assert, createMsaaTextureManager } from '@frozik/utils';
import { isNil } from 'lodash-es';
import type { BlockRegistry } from './block-registry';
import {
  INITIAL_GPU_BLOCKS,
  INITIAL_OFFSCREEN_HEIGHT,
  INITIAL_OFFSCREEN_WIDTH,
  MAX_GPU_BLOCKS,
  MAX_MID_PRICE_BLOCKS,
  MSAA_SAMPLE_COUNT,
  SNAPSHOT_SLOTS,
  TEXTURE_WIDTH_FALLBACK,
  TEXTURE_WIDTH_PREFERRED,
} from './constants';
import type { IBlockFlushEventBridge } from './flush-bridge';
import type { IHeatmapLayerResources, IVisibleBlock } from './heatmap-layer';
import {
  createHeatmapBindGroup,
  createHeatmapBindGroupLayout,
  createHeatmapResources,
  getHeatmapPipelineDescriptor,
  HEATMAP_VERTEX_COUNT_PER_INSTANCE,
  writeBlockDescriptors,
  writeHeatmapUniforms,
} from './heatmap-layer';
import { getTextureLayoutConfig, plotWidthDevicePx } from './math';
import type { MidPriceBlockIndex } from './mid-price-block-index';
import type { IMidPriceLayerResources, IMidPriceVisibleBlock } from './mid-price-layer';
import {
  createMidPriceBindGroup,
  createMidPriceBindGroupLayout,
  createMidPriceResources,
  getMidPriceInteriorPipelineDescriptor,
  getMidPriceOutlinePipelineDescriptor,
  MID_PRICE_VERTEX_COUNT_PER_INSTANCE,
  writeMidPriceBlockDescriptors,
  writeMidPriceUniforms,
} from './mid-price-layer';
import { MidPriceTextureRowManager } from './mid-price-texture-manager';
import { RenderTargetPool } from './render-target-pool';
import commonWgsl from './shaders/common.wgsl?raw';
import heatmapWgsl from './shaders/heatmap.wgsl?raw';
import midPriceWgsl from './shaders/mid-price.wgsl?raw';
import midPriceCommonWgsl from './shaders/mid-price-common.wgsl?raw';
import type { TaskManager } from './task-manager';
import { TextureRowManager } from './texture-row-manager';
import type { IOrderbookSnapshot, ITextureLayoutConfig, UnixTimeMs } from './types';

const heatmapShaderSource = commonWgsl + heatmapWgsl;
const midPriceShaderSource = midPriceCommonWgsl + midPriceWgsl;

// RENDER_ATTACHMENT (0x10) + COPY_DST (0x02) — offscreen canvas texture
// is used both as a render target (during swapchain acquire) and as a
// copy destination for the intermediate render target (Approach D).
const OFFSCREEN_CTX_USAGE = 0x10 | 0x02;

// Shared WebGPU scene background colour used across every demo. The
// CPU-side Canvas2D layer is filled with this tone before the heatmap
// bitmap is composited on top, so the spread-gap between best-bid and
// best-ask reads as the same dark surface as sun / graphics / landing.
const CHART_BACKGROUND_COLOR = '#07090c';

/**
 * Fire off an async `getCompilationInfo()` query on a freshly created
 * shader module and log every diagnostic (error / warning / info) to
 * the console. WGSL compilers — Safari especially — stay silent in
 * `createShaderModule` and only surface problems via this API, so
 * anything breaking a shader build shows up here with line / column
 * info instead of a cryptic pipeline-creation validation error.
 *
 * Non-blocking: we don't await it so pipeline creation isn't delayed
 * in the happy path. The promise is fire-and-forget.
 */
function logShaderDiagnostics(module: GPUShaderModule, label: string): void {
  void module.getCompilationInfo().then(info => {
    for (const message of info.messages) {
      const prefix = `binance-view: shader[${label}] ${message.type} L${message.lineNum}:${message.linePos} —`;
      if (message.type === 'error') {
        // biome-ignore lint/suspicious/noConsole: surfaces WGSL compile errors to aid cross-browser debugging
        console.error(prefix, message.message);
      } else if (message.type === 'warning') {
        // biome-ignore lint/suspicious/noConsole: surfaces WGSL compile warnings to aid cross-browser debugging
        console.warn(prefix, message.message);
      } else {
        // biome-ignore lint/suspicious/noConsole: surfaces WGSL compile info to aid cross-browser debugging
        console.info(prefix, message.message);
      }
    }
  });
}

/**
 * Force-compile a render pipeline via `createRenderPipelineAsync` and
 * log a detailed failure reason if compilation rejects. Unlike the
 * sync `createRenderPipeline` (which validates lazily at first draw
 * on some back-ends — notably Safari/Metal), the async variant
 * resolves only after the vertex / fragment libraries are fully
 * compiled, so a rejection carries the real error text rather than
 * the generic "Vertex library failed creation" that shows up later
 * in an uncapturederror.
 */
async function createPipelineWithLogging(
  device: GPUDevice,
  label: string,
  descriptor: GPURenderPipelineDescriptor
): Promise<GPURenderPipeline | null> {
  try {
    return await device.createRenderPipelineAsync(descriptor);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // biome-ignore lint/suspicious/noConsole: surfaces pipeline compile errors to aid cross-browser debugging
    console.error(
      `binance-view: pipeline[${label}] createRenderPipelineAsync failed —`,
      message,
      error
    );
    return null;
  }
}

export interface IRendererInitParams {
  readonly canvas: HTMLCanvasElement;
  readonly registry: BlockRegistry;
  readonly midPriceIndex: MidPriceBlockIndex;
  readonly taskManager: TaskManager;
  readonly updateSpeedMs: number;
  readonly priceStep: number;
}

/** Flush event from the mid-price accumulator — kept structurally identical to the orderbook bridge. */
export interface IMidPriceFlushEventBridge {
  readonly block: {
    readonly blockId: UnixTimeMs;
    readonly firstTimestampMs: UnixTimeMs;
    readonly basePrice: number;
    lastTimestampMs: UnixTimeMs;
    count: number;
    textureRowIndex: number | undefined;
  };
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedSamples: number;
}

export interface IRenderFrameInput {
  readonly viewTimeStartMs: UnixTimeMs;
  readonly viewTimeEndMs: UnixTimeMs;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly magnitudeMin: number;
  readonly magnitudeMax: number;
  readonly priceStep: number;
  readonly timeStepMs: number;
  /** Cursor position in CSS pixels relative to canvas, or `undefined` when outside. */
  readonly cursorCss: { readonly x: number; readonly y: number } | undefined;
  /**
   * Latest snapshot at the right edge of the viewport, used by the
   * Y-axis panel overlay to paint per-level volume bars. `undefined`
   * during warm-up (before the first 2 Hz driver tick) — the overlay
   * simply skips the bars in that case.
   */
  readonly lastSnapshot: IOrderbookSnapshot | undefined;
}

export interface IFrameOverlayInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly devicePixelRatio: number;
  readonly frame: IRenderFrameInput;
}

export type FrameOverlayCallback = (input: IFrameOverlayInput) => void;

/**
 * Single-canvas WebGPU renderer for the Binance orderbook heatmap.
 *
 * Uses Approach D so the visible canvas can remain a 2D context while
 * still hosting a WebGPU heatmap: GPU renders into an OffscreenCanvas,
 * `transferToImageBitmap` extracts the frame, and `drawImage` blits it
 * onto the visible canvas between grid + label passes. Layer order:
 *
 *   fill background → drawGridUnder → drawImage(heatmap) → drawAxisLabels
 *
 * which keeps grid lines *under* the heatmap cells and axis labels on
 * top (so they stay legible regardless of cell colour).
 */
export class BinanceHeatmapRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly layout: ITextureLayoutConfig;
  readonly textureRowManager: TextureRowManager;

  readonly midPriceTextureRowManager: MidPriceTextureRowManager;

  private readonly canvas: HTMLCanvasElement;
  private readonly registry: BlockRegistry;
  private readonly midPriceIndex: MidPriceBlockIndex;
  private readonly taskManager: TaskManager;
  private readonly offscreen: OffscreenCanvas;
  private readonly context: GPUCanvasContext;
  private readonly target2d: CanvasRenderingContext2D;
  private readonly msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  private readonly renderTargetPool = new RenderTargetPool();

  private readonly heatmapBindGroupLayout: GPUBindGroupLayout;
  private readonly heatmapPipeline: GPURenderPipeline;
  private readonly heatmapResources: IHeatmapLayerResources;
  private readonly midPriceBindGroupLayout: GPUBindGroupLayout;
  private readonly midPriceInteriorPipeline: GPURenderPipeline;
  private readonly midPriceOutlinePipeline: GPURenderPipeline;
  private readonly midPriceResources: IMidPriceLayerResources;

  private heatmapBindGroup: GPUBindGroup;
  private midPriceBindGroup: GPUBindGroup;
  private frameTaskUnsubscribe: (() => void) | undefined = undefined;
  private disposed = false;
  private needsReconfigure = false;
  private onFrameInput: (() => IRenderFrameInput) | null = null;
  private drawGridUnder: FrameOverlayCallback | null = null;
  private drawLabelsOver: FrameOverlayCallback | null = null;

  private constructor(params: {
    canvas: HTMLCanvasElement;
    registry: BlockRegistry;
    midPriceIndex: MidPriceBlockIndex;
    taskManager: TaskManager;
    device: GPUDevice;
    format: GPUTextureFormat;
    offscreen: OffscreenCanvas;
    context: GPUCanvasContext;
    target2d: CanvasRenderingContext2D;
    layout: ITextureLayoutConfig;
    heatmapBindGroupLayout: GPUBindGroupLayout;
    heatmapPipeline: GPURenderPipeline;
    midPriceBindGroupLayout: GPUBindGroupLayout;
    midPriceInteriorPipeline: GPURenderPipeline;
    midPriceOutlinePipeline: GPURenderPipeline;
  }) {
    this.canvas = params.canvas;
    this.registry = params.registry;
    this.midPriceIndex = params.midPriceIndex;
    this.taskManager = params.taskManager;
    this.device = params.device;
    this.format = params.format;
    this.offscreen = params.offscreen;
    this.context = params.context;
    this.target2d = params.target2d;
    this.layout = params.layout;

    this.textureRowManager = new TextureRowManager({
      device: this.device,
      layout: this.layout,
      initialBlocks: INITIAL_GPU_BLOCKS,
      maxBlocks: MAX_GPU_BLOCKS,
      onEvict: (blockId: UnixTimeMs) => {
        const item = this.registry.get(blockId);
        if (item !== undefined) {
          item.textureRowIndex = undefined;
        }
      },
    });

    this.midPriceTextureRowManager = new MidPriceTextureRowManager({
      device: this.device,
      onEvict: (blockId: UnixTimeMs) => {
        const item = this.midPriceIndex.get(blockId);
        if (item !== undefined) {
          item.textureRowIndex = undefined;
        }
      },
    });

    this.heatmapBindGroupLayout = params.heatmapBindGroupLayout;
    this.heatmapPipeline = params.heatmapPipeline;
    this.heatmapResources = createHeatmapResources(this.device, MAX_GPU_BLOCKS);
    this.heatmapBindGroup = createHeatmapBindGroup(
      this.device,
      this.heatmapBindGroupLayout,
      this.heatmapResources,
      this.textureRowManager.createView()
    );

    this.midPriceBindGroupLayout = params.midPriceBindGroupLayout;
    this.midPriceInteriorPipeline = params.midPriceInteriorPipeline;
    this.midPriceOutlinePipeline = params.midPriceOutlinePipeline;
    this.midPriceResources = createMidPriceResources(this.device, MAX_MID_PRICE_BLOCKS);
    this.midPriceBindGroup = createMidPriceBindGroup(
      this.device,
      this.midPriceBindGroupLayout,
      this.midPriceResources,
      this.midPriceTextureRowManager.createView()
    );
  }

  static async create(params: IRendererInitParams): Promise<BinanceHeatmapRenderer | null> {
    assert(!isNil(navigator.gpu), 'WebGPU is not supported');

    const adapter = await navigator.gpu.requestAdapter();
    if (isNil(adapter)) {
      return null;
    }

    const preferredMax = TEXTURE_WIDTH_PREFERRED;
    const supportsPreferred = adapter.limits.maxTextureDimension2D >= preferredMax;
    const requestedLimits: Record<string, number> = {};
    if (supportsPreferred) {
      requestedLimits.maxTextureDimension2D = preferredMax;
    }

    let device: GPUDevice;
    try {
      device = await adapter.requestDevice({ requiredLimits: requestedLimits });
    } catch {
      return null;
    }

    // Surface every uncaptured validation / internal / out-of-memory
    // error from the device. Safari's WebGPU in particular has
    // historically been silent on pipeline / render-pass issues —
    // without this handler a broken pipeline state or a format
    // mismatch produces a blank canvas with no console output.
    // Catches errors for the device's whole lifetime.
    device.addEventListener('uncapturederror', event => {
      const gpuEvent = event as GPUUncapturedErrorEvent;
      const error = gpuEvent.error;
      // biome-ignore lint/suspicious/noConsole: surfaces WebGPU device errors that would otherwise be invisible
      console.error(
        `binance-view: webgpu uncapturederror (${error.constructor.name}) —`,
        error.message
      );
    });

    const supportedLimit = device.limits.maxTextureDimension2D;
    if (supportedLimit < TEXTURE_WIDTH_FALLBACK) {
      device.destroy();
      return null;
    }

    const layout = getTextureLayoutConfig(supportedLimit);

    const offscreen = new OffscreenCanvas(INITIAL_OFFSCREEN_WIDTH, INITIAL_OFFSCREEN_HEIGHT);
    const context = offscreen.getContext('webgpu');
    assert(!isNil(context), 'Failed to get WebGPU context on OffscreenCanvas');

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied', usage: OFFSCREEN_CTX_USAGE });

    const target2d = params.canvas.getContext('2d');
    assert(!isNil(target2d), 'Failed to get 2D context on visible canvas');

    const heatmapModule = device.createShaderModule({
      code: heatmapShaderSource,
      label: 'heatmap.shader',
    });
    logShaderDiagnostics(heatmapModule, 'heatmap.shader');
    const midPriceModule = device.createShaderModule({
      code: midPriceShaderSource,
      label: 'mid-price.shader',
    });
    logShaderDiagnostics(midPriceModule, 'mid-price.shader');

    const heatmapBindGroupLayout = createHeatmapBindGroupLayout(device);
    const midPriceBindGroupLayout = createMidPriceBindGroupLayout(device);

    // Async pipeline creation forces WGSL→MSL compilation up-front
    // instead of letting Safari's Metal back-end defer it to the first
    // draw. Any WGSL/validation failure now arrives as a rejected
    // promise with the real error text (logged by `createPipelineWithLogging`)
    // rather than a generic `Vertex library failed creation` message
    // landing in `uncapturederror` at an untraceable moment.
    const [heatmapPipeline, midPriceInteriorPipeline, midPriceOutlinePipeline] = await Promise.all([
      createPipelineWithLogging(
        device,
        'heatmap',
        getHeatmapPipelineDescriptor({
          device,
          module: heatmapModule,
          layout: heatmapBindGroupLayout,
          format,
          layoutConfig: layout,
        })
      ),
      createPipelineWithLogging(
        device,
        'mid-price.interior',
        getMidPriceInteriorPipelineDescriptor({
          device,
          module: midPriceModule,
          layout: midPriceBindGroupLayout,
          format,
        })
      ),
      createPipelineWithLogging(
        device,
        'mid-price.outline',
        getMidPriceOutlinePipelineDescriptor({
          device,
          module: midPriceModule,
          layout: midPriceBindGroupLayout,
          format,
        })
      ),
    ]);

    if (
      heatmapPipeline === null ||
      midPriceInteriorPipeline === null ||
      midPriceOutlinePipeline === null
    ) {
      device.destroy();
      return null;
    }

    return new BinanceHeatmapRenderer({
      canvas: params.canvas,
      registry: params.registry,
      midPriceIndex: params.midPriceIndex,
      taskManager: params.taskManager,
      device,
      format,
      offscreen,
      context,
      target2d,
      layout,
      heatmapBindGroupLayout,
      heatmapPipeline,
      midPriceBindGroupLayout,
      midPriceInteriorPipeline,
      midPriceOutlinePipeline,
    });
  }

  setFrameInputSource(source: () => IRenderFrameInput): void {
    this.onFrameInput = source;
  }

  setGridUnderCallback(callback: FrameOverlayCallback | null): void {
    this.drawGridUnder = callback;
  }

  setLabelsOverCallback(callback: FrameOverlayCallback | null): void {
    this.drawLabelsOver = callback;
  }

  start(): void {
    if (this.frameTaskUnsubscribe !== undefined || this.disposed) {
      return;
    }
    // The shared TaskManager already gates by the feature-level
    // FpsController — subscribing with `minIntervalMs: 0` means
    // "render on every scheduler tick" and lets the FPS level do the
    // throttling.
    this.frameTaskUnsubscribe = this.taskManager.subscribe(this.renderFrame, {
      minIntervalMs: 0,
    });
  }

  stop(): void {
    this.frameTaskUnsubscribe?.();
    this.frameTaskUnsubscribe = undefined;
  }

  releaseBlockSlot(blockId: UnixTimeMs): void {
    this.textureRowManager.release(blockId);
  }

  releaseMidPriceBlockSlot(blockId: UnixTimeMs): void {
    this.midPriceTextureRowManager.release(blockId);
  }

  /**
   * Upload new mid-price samples to the GPU texture and upsert the
   * corresponding entry into the mid-price index. `addedSamples` is
   * the count of samples written on the tail of the active block
   * since the previous flush.
   */
  writeFlushedMidPriceSamples(event: IMidPriceFlushEventBridge): void {
    const meta = event.block;
    const slotIndex = this.midPriceTextureRowManager.allocate(meta.blockId);
    meta.textureRowIndex = slotIndex;

    const firstSampleIndex = meta.count - event.addedSamples;
    const floatsPerSample = 4;
    const dataOffsetFloats = firstSampleIndex * floatsPerSample;

    this.midPriceTextureRowManager.writeSamples(
      slotIndex,
      firstSampleIndex,
      event.addedSamples,
      event.data,
      dataOffsetFloats
    );

    this.midPriceIndex.upsert({
      blockId: meta.blockId,
      firstTimestampMs: meta.firstTimestampMs,
      basePrice: meta.basePrice,
      lastTimestampMs: meta.lastTimestampMs,
      count: meta.count,
      textureRowIndex: slotIndex,
    });
  }

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

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stop();
    this.textureRowManager.dispose();
    this.midPriceTextureRowManager.dispose();
    this.msaaManager.dispose();
    this.renderTargetPool.dispose();
    this.heatmapResources.uniformsBuffer.destroy();
    this.heatmapResources.descriptorsBuffer.destroy();
    this.midPriceResources.uniformsBuffer.destroy();
    this.midPriceResources.descriptorsBuffer.destroy();
    this.device.destroy();
  }

  private syncCanvasSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return { width, height };
  }

  private computeVisibleBlocks(viewStartMs: UnixTimeMs, viewEndMs: UnixTimeMs): IVisibleBlock[] {
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

  /**
   * Collect mid-price blocks overlapping the visible window, widened
   * by one cross-block segment on each side so the line keeps reading
   * correctly at the boundaries (a segment spans the point *outside*
   * the block that samples N-1 and 0 sit in). Each visible block is
   * paired with the texture offset of its first sample so the shader
   * can `textureLoad` directly.
   */
  private computeVisibleMidPriceBlocks(
    viewStartMs: UnixTimeMs,
    viewEndMs: UnixTimeMs
  ): IMidPriceVisibleBlock[] {
    const hits = this.midPriceIndex.searchRange(viewStartMs, viewEndMs);
    const visible: IMidPriceVisibleBlock[] = [];
    for (const item of hits) {
      if (item.textureRowIndex === undefined) {
        continue;
      }
      this.midPriceTextureRowManager.touch(item.blockId);
      visible.push({
        item,
        textureOffset: this.midPriceTextureRowManager.slotTextureOffset(item.textureRowIndex),
      });
    }
    return visible;
  }

  private readonly renderFrame = (): void => {
    if (this.disposed || this.onFrameInput === null) {
      return;
    }
    const { width, height } = this.syncCanvasSize();
    if (width === 0 || height === 0) {
      return;
    }

    const input = this.onFrameInput();
    const visibleBlocks = this.computeVisibleBlocks(input.viewTimeStartMs, input.viewTimeEndMs);
    const visibleMidPriceBlocks = this.computeVisibleMidPriceBlocks(
      input.viewTimeStartMs,
      input.viewTimeEndMs
    );

    const dpr = Math.max(1, window.devicePixelRatio);
    const plotWidthPx = plotWidthDevicePx(width, dpr);

    let totalInstances = 0;
    if (visibleBlocks.length > 0) {
      const globalBaseTimeMs = visibleBlocks[0].meta.firstTimestampMs;
      const result = writeBlockDescriptors(
        this.device,
        this.heatmapResources.descriptorsBuffer,
        visibleBlocks,
        globalBaseTimeMs
      );
      totalInstances = result.totalInstances;

      writeHeatmapUniforms(this.device, this.heatmapResources.uniformsBuffer, {
        canvasWidth: width,
        canvasHeight: height,
        plotWidthPx,
        viewTimeStartDeltaMs: input.viewTimeStartMs - globalBaseTimeMs,
        viewTimeEndDeltaMs: input.viewTimeEndMs - globalBaseTimeMs,
        timeStepMs: input.timeStepMs,
        priceStep: input.priceStep,
        priceMin: input.priceMin,
        priceMax: input.priceMax,
        magnitudeMin: input.magnitudeMin,
        magnitudeMax: input.magnitudeMax,
        blockCount: visibleBlocks.length,
      });
    }

    let totalMidPriceSegments = 0;
    if (visibleMidPriceBlocks.length > 0) {
      const midPriceBaseTimeMs = visibleMidPriceBlocks[0].item.firstTimestampMs;
      const { totalSegments } = writeMidPriceBlockDescriptors(
        this.device,
        this.midPriceResources.descriptorsBuffer,
        visibleMidPriceBlocks,
        midPriceBaseTimeMs
      );
      totalMidPriceSegments = totalSegments;
      writeMidPriceUniforms(this.device, this.midPriceResources.uniformsBuffer, {
        canvasWidth: width,
        canvasHeight: height,
        plotWidthPx,
        viewTimeStartDeltaMs: input.viewTimeStartMs - midPriceBaseTimeMs,
        viewTimeEndDeltaMs: input.viewTimeEndMs - midPriceBaseTimeMs,
        priceMin: input.priceMin,
        priceMax: input.priceMax,
        blockCount: visibleMidPriceBlocks.length,
      });
    }

    const bitmap = this.renderOffscreenFrame(width, height, totalInstances, totalMidPriceSegments);

    // Visible canvas composition: paint the grid first, then blit the
    // fully-opaque heatmap bitmap over it (the opaque render-pass
    // clear guarantees no sub-pixel alpha leaks), then axis labels on
    // top. The grid stays *under* the heatmap and is only visible
    // outside the cell quads if the bitmap ever leaves transparent
    // pixels — which it never does with the current clear colour.
    this.target2d.fillStyle = CHART_BACKGROUND_COLOR;
    this.target2d.fillRect(0, 0, width, height);
    this.invokeOverlay(this.drawGridUnder, width, height, input);
    if (bitmap !== null) {
      this.target2d.drawImage(bitmap, 0, 0);
      bitmap.close();
    }
    this.invokeOverlay(this.drawLabelsOver, width, height, input);
  };

  private renderOffscreenFrame(
    width: number,
    height: number,
    totalInstances: number,
    totalMidPriceSegments: number
  ): ImageBitmap | null {
    if (
      this.offscreen.width !== width ||
      this.offscreen.height !== height ||
      this.needsReconfigure
    ) {
      this.offscreen.width = width;
      this.offscreen.height = height;
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
        usage: OFFSCREEN_CTX_USAGE,
      });
      this.needsReconfigure = false;
    }

    const msaaView = this.msaaManager.ensureView(this.device, this.format, width, height);
    if (msaaView === null) {
      return null;
    }

    const renderTarget = this.renderTargetPool.acquire(this.device, width, height, this.format);
    const encoder = this.device.createCommandEncoder({ label: 'binance.frame' });

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: renderTarget.createView(),
          loadOp: 'clear',
          // Transparent clear so the grid painted under the bitmap
          // remains visible in the spread-gap between best-bid and
          // best-ask (and any other cell-free area). Cell quads
          // draw with alpha=1 and 0.5 px overdraw on each edge so
          // MSAA sub-pixel seams don't bleed the grid through.
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });

    if (totalInstances > 0) {
      pass.setPipeline(this.heatmapPipeline);
      pass.setBindGroup(0, this.heatmapBindGroup);
      pass.draw(HEATMAP_VERTEX_COUNT_PER_INSTANCE, totalInstances, 0, 0);
    }

    if (totalMidPriceSegments > 0) {
      pass.setBindGroup(0, this.midPriceBindGroup);

      // Pass A — outline. Stamps black annulus for every segment.
      // Adjacent outlines overlap harmlessly (black on black).
      pass.setPipeline(this.midPriceOutlinePipeline);
      pass.draw(MID_PRICE_VERTEX_COUNT_PER_INSTANCE, totalMidPriceSegments, 0, 0);

      // Pass B — interior. Coloured core of every segment overwrites
      // whatever outlines were stamped into its footprint, including
      // the outline of any other segment that happened to bleed in.
      // That's what stops a later turning-segment's outline from
      // sitting on top of an earlier segment's body.
      pass.setPipeline(this.midPriceInteriorPipeline);
      pass.draw(MID_PRICE_VERTEX_COUNT_PER_INSTANCE, totalMidPriceSegments, 0, 0);
    }

    pass.end();

    const canvasTexture = this.context.getCurrentTexture();
    encoder.copyTextureToTexture({ texture: renderTarget }, { texture: canvasTexture }, [
      width,
      height,
    ]);
    this.device.queue.submit([encoder.finish()]);
    this.renderTargetPool.release(renderTarget);

    const bitmap = this.offscreen.transferToImageBitmap();
    this.needsReconfigure = true;
    return bitmap;
  }

  private invokeOverlay(
    callback: FrameOverlayCallback | null,
    width: number,
    height: number,
    frame: IRenderFrameInput
  ): void {
    if (callback === null) {
      return;
    }
    callback({
      ctx: this.target2d,
      canvasWidthPx: width,
      canvasHeightPx: height,
      devicePixelRatio: Math.max(1, window.devicePixelRatio),
      frame,
    });
  }
}
