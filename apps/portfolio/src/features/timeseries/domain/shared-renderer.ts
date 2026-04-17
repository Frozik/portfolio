import { assert, createMsaaTextureManager, MS_PER_SECOND } from '@frozik/utils';
import { isNil } from 'lodash-es';

import {
  FPS_IDLE,
  INITIAL_OFFSCREEN_HEIGHT,
  INITIAL_OFFSCREEN_WIDTH,
  MSAA_SAMPLE_COUNT,
} from './constants';
import candlestickSpecificSource from './shaders/candlestick.wgsl?raw';
import commonShaderSource from './shaders/common.wgsl?raw';
import debugLinesSource from './shaders/debug-lines.wgsl?raw';
import lineSpecificSource from './shaders/line.wgsl?raw';
import rhombusSpecificSource from './shaders/rhombus.wgsl?raw';

const lineShaderSource = commonShaderSource + lineSpecificSource;
const candlestickShaderSource = commonShaderSource + candlestickSpecificSource;
const rhombusShaderSource = commonShaderSource + rhombusSpecificSource;
const debugShaderSource = commonShaderSource + debugLinesSource;

import { RenderTargetPool } from './render-target-pool';
import type { IPlotArea, ISharedTimeseriesRenderer, ITimeseriesChart } from './types';

const THROTTLE_TOLERANCE_MS = 2;
const MIN_FPS_WINDOW_MS = 1000;
const FPS_UPDATE_INTERVAL_MS = 250;
const LOADING_BAR_HEIGHT_PX = 5;
const SHIMMER_COLOR_LIGHT = 'rgba(100, 160, 255, 0.6)';
const SHIMMER_COLOR_DARK = 'rgba(30, 80, 180, 0.8)';
const SHIMMER_CYCLE_MS = 1200;

export async function createSharedRenderer(): Promise<ISharedTimeseriesRenderer> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const offscreen = new OffscreenCanvas(INITIAL_OFFSCREEN_WIDTH, INITIAL_OFFSCREEN_HEIGHT);
  const ctx = offscreen.getContext('webgpu');
  assert(!isNil(ctx), 'Failed to get WebGPU context on OffscreenCanvas');

  const format = navigator.gpu.getPreferredCanvasFormat();
  // COPY_DST (0x02) needed: render target is copied into this canvas texture via
  // copyTextureToTexture in the same command encoder (Approach D for iOS sync fix)
  ctx.configure({ device, format, alphaMode: 'premultiplied', usage: 0x10 | 0x02 });

  const lineShaderModule = device.createShaderModule({ code: lineShaderSource });
  const candlestickShaderModule = device.createShaderModule({ code: candlestickShaderSource });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float', viewDimension: '2d' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const alphaBlend: GPUBlendState = {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
  };

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

  const linePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: lineShaderModule, entryPoint: 'vs' },
    fragment: {
      module: lineShaderModule,
      entryPoint: 'fs',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  const candlestickPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: candlestickShaderModule, entryPoint: 'vsCandlestick' },
    fragment: {
      module: candlestickShaderModule,
      entryPoint: 'fsCandlestick',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  const rhombusShaderModule = device.createShaderModule({ code: rhombusShaderSource });

  const rhombusPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: rhombusShaderModule, entryPoint: 'vsRhombus' },
    fragment: {
      module: rhombusShaderModule,
      entryPoint: 'fsRhombus',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  const debugShaderModule = device.createShaderModule({ code: debugShaderSource });

  const debugPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: debugShaderModule, entryPoint: 'vsDebugLines' },
    fragment: {
      module: debugShaderModule,
      entryPoint: 'fsDebugLines',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  return new SharedTimeseriesRenderer(
    device,
    format,
    bindGroupLayout,
    linePipeline,
    candlestickPipeline,
    rhombusPipeline,
    debugPipeline,
    offscreen,
    ctx
  );
}

class SharedTimeseriesRenderer implements ISharedTimeseriesRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly linePipeline: GPURenderPipeline;
  readonly candlestickPipeline: GPURenderPipeline;
  readonly rhombusPipeline: GPURenderPipeline;
  readonly debugPipeline: GPURenderPipeline;
  debugMode = false;
  instantLoad = true;
  renderFps = 0;

  private readonly offscreen: OffscreenCanvas;
  private readonly ctx: GPUCanvasContext;
  private readonly charts = new Set<ITimeseriesChart>();
  private readonly msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  private readonly renderTargetPool = new RenderTargetPool();

  private animationFrameId = 0;
  private lastFrameTime = 0;
  private disposed = false;
  private needsReconfigure = false;
  private readonly renderFrameTimes: number[] = [];
  private lastFpsUpdate = 0;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    bindGroupLayout: GPUBindGroupLayout,
    linePipeline: GPURenderPipeline,
    candlestickPipeline: GPURenderPipeline,
    rhombusPipeline: GPURenderPipeline,
    debugPipeline: GPURenderPipeline,
    offscreen: OffscreenCanvas,
    ctx: GPUCanvasContext
  ) {
    this.device = device;
    this.format = format;
    this.bindGroupLayout = bindGroupLayout;
    this.linePipeline = linePipeline;
    this.candlestickPipeline = candlestickPipeline;
    this.rhombusPipeline = rhombusPipeline;
    this.debugPipeline = debugPipeline;
    this.offscreen = offscreen;
    this.ctx = ctx;
  }

  registerChart(chart: ITimeseriesChart): VoidFunction {
    this.charts.add(chart);

    if (this.charts.size === 1) {
      this.startAnimationLoop();
    }

    return () => {
      this.charts.delete(chart);
      chart.dispose();

      if (this.charts.size === 0) {
        this.stopAnimationLoop();
      }
    };
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.stopAnimationLoop();

    for (const chart of this.charts) {
      chart.dispose();
    }
    this.charts.clear();

    this.msaaManager.dispose();
    this.renderTargetPool.dispose();
    this.device.destroy();
  }

  private getMinFrameIntervalMs(): number {
    let minInterval: number | undefined;

    for (const chart of this.charts) {
      const interval = chart.fpsController.getFrameIntervalMs();
      if (isNil(minInterval) || interval < minInterval) {
        minInterval = interval;
      }
    }

    return minInterval ?? MS_PER_SECOND / FPS_IDLE;
  }

  private startAnimationLoop(): void {
    if (this.disposed) {
      return;
    }

    const frame = (now: number): void => {
      if (this.disposed) {
        return;
      }

      for (const chart of this.charts) {
        chart.fpsController.tick();
      }

      const minInterval = this.getMinFrameIntervalMs();
      if (now - this.lastFrameTime < minInterval - THROTTLE_TOLERANCE_MS) {
        this.animationFrameId = requestAnimationFrame(frame);
        return;
      }

      this.lastFrameTime = now;
      this.trackRenderFps(now);
      this.renderAllCharts();
      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  private trackRenderFps(now: number): void {
    // Use a window that captures at least 3 frames at the current rate
    const fpsWindowMs = Math.max(MIN_FPS_WINDOW_MS, this.getMinFrameIntervalMs() * 3);

    this.renderFrameTimes.push(now);

    // Trim old entries beyond the window
    const cutoff = now - fpsWindowMs;
    while (this.renderFrameTimes.length > 0 && this.renderFrameTimes[0] < cutoff) {
      this.renderFrameTimes.shift();
    }

    // Update FPS periodically
    if (now - this.lastFpsUpdate >= FPS_UPDATE_INTERVAL_MS) {
      this.lastFpsUpdate = now;
      const elapsed =
        this.renderFrameTimes.length > 1
          ? this.renderFrameTimes[this.renderFrameTimes.length - 1] - this.renderFrameTimes[0]
          : 0;
      this.renderFps =
        elapsed > 0
          ? Math.round(((this.renderFrameTimes.length - 1) / elapsed) * MS_PER_SECOND)
          : 0;
    }
  }

  private stopAnimationLoop(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
  }

  private drawLoadingBars(chart: ITimeseriesChart): void {
    const regions = chart.getLoadingRegions();
    if (regions.length === 0) {
      return;
    }

    const viewport = chart.getViewport();
    const timeRange = viewport.timeEnd - viewport.timeStart;
    if (timeRange <= 0) {
      return;
    }

    const ctx = chart.target2dContext;
    const canvasWidth = chart.width;
    const canvasHeight = chart.height;
    const barHeight = LOADING_BAR_HEIGHT_PX * Math.max(1, window.devicePixelRatio);
    const barY = canvasHeight - barHeight;
    const phase = (performance.now() % SHIMMER_CYCLE_MS) / SHIMMER_CYCLE_MS;

    for (const region of regions) {
      const startNorm = (region.timeStart - viewport.timeStart) / timeRange;
      const endNorm = (region.timeEnd - viewport.timeStart) / timeRange;

      const pixelStart = Math.max(0, Math.floor(startNorm * canvasWidth));
      const pixelEnd = Math.min(canvasWidth, Math.ceil(endNorm * canvasWidth));
      const pixelWidth = pixelEnd - pixelStart;

      if (pixelWidth <= 0) {
        continue;
      }

      // Shimmer gradient: light→dark→light sliding vertically
      const gradientHeight = barHeight * 2;
      const shimmerY = barY - gradientHeight + phase * gradientHeight;

      const gradient = ctx.createLinearGradient(0, shimmerY, 0, shimmerY + gradientHeight);
      gradient.addColorStop(0, SHIMMER_COLOR_LIGHT);
      gradient.addColorStop(0.5, SHIMMER_COLOR_DARK);
      gradient.addColorStop(1, SHIMMER_COLOR_LIGHT);

      ctx.save();
      ctx.beginPath();
      ctx.rect(pixelStart, barY, pixelWidth, barHeight);
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(pixelStart, shimmerY, pixelWidth, gradientHeight);
      ctx.restore();
    }
  }

  private ensureMsaaView(width: number, height: number): GPUTextureView | null {
    return this.msaaManager.ensureView(this.device, this.format, width, height);
  }

  private renderAllCharts(): void {
    for (const chart of this.charts) {
      chart.update();

      const { width, height } = chart;

      if (width === 0 || height === 0) {
        continue;
      }

      const plotArea = chart.prepareDrawCommands();

      if (isNil(plotArea)) {
        continue;
      }

      this.renderChart(chart, plotArea);

      // Axes drawn on 2D canvas after WebGPU blit so they appear on top
      chart.renderCanvasAxes();

      // Draw loading bars for blocks being "fetched"
      this.drawLoadingBars(chart);
    }
  }

  /**
   * Approach D: render to intermediate GPUTexture, then copy to canvas texture
   * in the same command encoder.
   *
   * This guarantees GPU execution order (render → copy) within a single submit,
   * eliminating the iOS Safari race condition where transferToImageBitmap()
   * could capture stale pixels from a previous chart's render pass.
   *
   * Flow: MSAA → resolve to renderTarget → copyTextureToTexture to canvasTexture
   *       → submit → transferToImageBitmap → drawImage to visible 2D canvas
   */
  private renderChart(chart: ITimeseriesChart, plotArea: IPlotArea): void {
    const { width, height } = chart;

    // Resize shared OffscreenCanvas and reconfigure if dimensions changed or
    // backing store was detached by previous transferToImageBitmap
    if (
      this.offscreen.width !== width ||
      this.offscreen.height !== height ||
      this.needsReconfigure
    ) {
      this.offscreen.width = width;
      this.offscreen.height = height;
      // COPY_DST (0x02): canvas texture receives data via copyTextureToTexture
      // RENDER_ATTACHMENT (0x10): kept for spec compatibility
      this.ctx.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
        usage: 0x10 | 0x02,
      });
      this.needsReconfigure = false;
    }

    // Acquire a reusable render target from the pool
    const renderTarget = this.renderTargetPool.acquire(this.device, width, height, this.format);

    const currentMsaaView = this.ensureMsaaView(width, height);

    if (isNil(currentMsaaView)) {
      this.renderTargetPool.release(renderTarget);
      return;
    }

    const encoder = this.device.createCommandEncoder();

    // Render pass: MSAA texture → resolve to intermediate render target
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentMsaaView,
          resolveTarget: renderTarget.createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });

    chart.seriesManager.renderAll(pass, plotArea);

    if (this.debugMode) {
      chart.seriesManager.renderDebug(pass, this.debugPipeline, plotArea);
    }

    pass.end();

    // Copy render target → OffscreenCanvas texture (same command encoder).
    // GPU executes render pass and copy in order within a single submit,
    // so the canvas texture is guaranteed to contain correct pixels.
    const canvasTexture = this.ctx.getCurrentTexture();
    encoder.copyTextureToTexture({ texture: renderTarget }, { texture: canvasTexture }, [
      width,
      height,
    ]);

    // Single submit: render + copy are atomic from the GPU perspective
    this.device.queue.submit([encoder.finish()]);

    this.renderTargetPool.release(renderTarget);

    // Sync visible canvas pixel dimensions before blit to avoid blank-frame flicker
    chart.syncCanvasSize();

    // transferToImageBitmap is now safe — the canvas texture was written by
    // copyTextureToTexture in the same command buffer as the render pass
    const bitmap = this.offscreen.transferToImageBitmap();
    this.needsReconfigure = true;

    // Draw background + grid on 2D canvas, then blit WebGPU result on top
    chart.renderCanvasGrid();
    chart.target2dContext.drawImage(bitmap, 0, 0);
    bitmap.close();
  }
}
