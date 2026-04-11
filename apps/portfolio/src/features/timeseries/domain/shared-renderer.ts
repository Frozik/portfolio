import { assert, createMsaaTextureManager } from '@frozik/utils';
import { isNil } from 'lodash-es';

import {
  INITIAL_OFFSCREEN_HEIGHT,
  INITIAL_OFFSCREEN_WIDTH,
  MS_PER_SECOND,
  MSAA_SAMPLE_COUNT,
} from './constants';
import { EFpsLevel } from './fps-controller';
import candlestickSpecificSource from './shaders/candlestick.wgsl?raw';
import commonShaderSource from './shaders/common.wgsl?raw';
import debugLinesSource from './shaders/debug-lines.wgsl?raw';
import lineSpecificSource from './shaders/line.wgsl?raw';
import rhombusSpecificSource from './shaders/rhombus.wgsl?raw';

const lineShaderSource = commonShaderSource + lineSpecificSource;
const candlestickShaderSource = commonShaderSource + candlestickSpecificSource;
const rhombusShaderSource = commonShaderSource + rhombusSpecificSource;
const debugShaderSource = commonShaderSource + debugLinesSource;

import type { ISharedTimeseriesRenderer, ITimeseriesChart } from './types';

const LOADING_BAR_HEIGHT_PX = 5;
const SHIMMER_COLOR_LIGHT = 'rgba(100, 160, 255, 0.6)';
const SHIMMER_COLOR_DARK = 'rgba(30, 80, 180, 0.8)';
const SHIMMER_SPEED_DIVISOR = 800;

export async function createSharedRenderer(): Promise<ISharedTimeseriesRenderer> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const offscreen = new OffscreenCanvas(INITIAL_OFFSCREEN_WIDTH, INITIAL_OFFSCREEN_HEIGHT);
  const ctx = offscreen.getContext('webgpu');
  assert(!isNil(ctx), 'Failed to get WebGPU context on OffscreenCanvas');

  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

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
  renderFps = 0;

  private readonly offscreen: OffscreenCanvas;
  private readonly ctx: GPUCanvasContext;
  private readonly charts = new Set<ITimeseriesChart>();
  private readonly msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);

  private animationFrameId = 0;
  private lastFrameTime = 0;
  private disposed = false;
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

    return minInterval ?? MS_PER_SECOND / EFpsLevel.Idle;
  }

  private startAnimationLoop(): void {
    if (this.disposed) {
      return;
    }

    const frame = (now: number): void => {
      if (this.disposed) {
        return;
      }

      const minInterval = this.getMinFrameIntervalMs();

      if (now - this.lastFrameTime < minInterval) {
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
    const FPS_WINDOW_MS = 1000;
    const FPS_UPDATE_INTERVAL_MS = 250;

    this.renderFrameTimes.push(now);

    // Trim old entries beyond the window
    const cutoff = now - FPS_WINDOW_MS;
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
    const now = performance.now() / SHIMMER_SPEED_DIVISOR;

    for (const region of regions) {
      const startNorm = (region.timeStart - viewport.timeStart) / timeRange;
      const endNorm = (region.timeEnd - viewport.timeStart) / timeRange;

      const pixelStart = Math.max(0, Math.floor(startNorm * canvasWidth));
      const pixelEnd = Math.min(canvasWidth, Math.ceil(endNorm * canvasWidth));
      const pixelWidth = pixelEnd - pixelStart;

      if (pixelWidth <= 0) {
        continue;
      }

      // Shimmer gradient: animate offset over time
      const shimmerOffset = (now % 1) * pixelWidth;
      const gradient = ctx.createLinearGradient(
        pixelStart + shimmerOffset - pixelWidth,
        0,
        pixelStart + shimmerOffset,
        0
      );
      gradient.addColorStop(0, SHIMMER_COLOR_LIGHT);
      gradient.addColorStop(0.5, SHIMMER_COLOR_DARK);
      gradient.addColorStop(1, SHIMMER_COLOR_LIGHT);

      ctx.fillStyle = gradient;
      ctx.fillRect(pixelStart, barY, pixelWidth, barHeight);
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

      // Resize offscreen canvas to match chart dimensions
      if (this.offscreen.width !== width || this.offscreen.height !== height) {
        this.offscreen.width = width;
        this.offscreen.height = height;

        this.ctx.configure({
          device: this.device,
          format: this.format,
          alphaMode: 'premultiplied',
        });
      }

      // Get the actual texture first — its size may differ from what we requested
      const canvasTexture = this.ctx.getCurrentTexture();
      const currentMsaaView = this.ensureMsaaView(canvasTexture.width, canvasTexture.height);

      if (isNil(currentMsaaView)) {
        continue;
      }

      const canvasTexView = canvasTexture.createView();
      const encoder = this.device.createCommandEncoder();

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentMsaaView,
            resolveTarget: canvasTexView,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'discard',
          },
        ],
      });

      // Delegate rendering to the chart's series manager
      chart.seriesManager.renderAll(pass, plotArea);

      // Debug: draw vertical lines at block boundaries
      if (this.debugMode) {
        chart.seriesManager.renderDebug(pass, this.debugPipeline, plotArea);
      }

      pass.end();
      this.device.queue.submit([encoder.finish()]);

      // Sync visible canvas size right before blit to avoid blank-frame flicker.
      // Setting canvas.width/height clears it, so we do it immediately before drawImage.
      chart.syncCanvasSize();

      const bitmap = this.offscreen.transferToImageBitmap();
      chart.target2dContext.clearRect(0, 0, chart.width, chart.height);
      chart.target2dContext.drawImage(bitmap, 0, 0);
      bitmap.close();

      // Draw loading bars for blocks being "fetched"
      this.drawLoadingBars(chart);

      chart.renderOverlay();
    }
  }
}
