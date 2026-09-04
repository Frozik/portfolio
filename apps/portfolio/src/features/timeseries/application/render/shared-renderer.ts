import { assert } from '@frozik/utils/assert/assert';
import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import { FpsMeter } from '@frozik/utils/webgpu/fpsMeter';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderTargetPool } from '@frozik/utils/webgpu/renderTargetPool';
import { isNil } from 'lodash-es';

import {
  FPS_IDLE,
  INITIAL_OFFSCREEN_HEIGHT,
  INITIAL_OFFSCREEN_WIDTH,
  MSAA_SAMPLE_COUNT,
} from '../../domain/constants';
import type { IPlotArea } from '../../domain/types';
import type { ISharedGpuResources } from '../../infrastructure/shared-gpu-resources';
import { createSharedGpuResources } from '../../infrastructure/shared-gpu-resources';
import type { ISharedTimeseriesRenderer, ITimeseriesChart } from './types';

const THROTTLE_TOLERANCE_MS = 2;
/** The canvas texture is written by `copyTextureToTexture`, see the blit note on `renderChart`. */
const OFFSCREEN_USAGE = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST;

export async function createSharedRenderer(): Promise<ISharedTimeseriesRenderer> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');
  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const offscreen = new OffscreenCanvas(INITIAL_OFFSCREEN_WIDTH, INITIAL_OFFSCREEN_HEIGHT);
  const context = offscreen.getContext('webgpu');
  assert(!isNil(context), 'Failed to get WebGPU context on OffscreenCanvas');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied', usage: OFFSCREEN_USAGE });

  return new SharedTimeseriesRenderer(
    device,
    format,
    createSharedGpuResources(device, format),
    offscreen,
    context
  );
}

/** One device, one frame loop and one offscreen canvas serving every chart in the grid. */
class SharedTimeseriesRenderer implements ISharedTimeseriesRenderer {
  debugMode = false;
  instantLoad = true;
  renderFps = 0;

  private readonly charts = new Set<ITimeseriesChart>();
  private readonly msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  private readonly renderTargetPool = new RenderTargetPool();
  private readonly fpsMeter = new FpsMeter({
    onUpdate: fps => {
      this.renderFps = fps;
    },
  });
  private animationFrameId = 0;
  private lastFrameTime = 0;
  private disposed = false;
  private needsReconfigure = false;

  constructor(
    readonly device: GPUDevice,
    readonly format: GPUTextureFormat,
    readonly resources: ISharedGpuResources,
    private readonly offscreen: OffscreenCanvas,
    private readonly context: GPUCanvasContext
  ) {}

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  setInstantLoad(enabled: boolean): void {
    this.instantLoad = enabled;
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

  /** The loop runs at the fastest rate any chart currently asks for. */
  private getMinFrameIntervalMs(): number {
    let minInterval: number | undefined;
    for (const chart of this.charts) {
      if (isNil(minInterval) || chart.frameIntervalMs < minInterval) {
        minInterval = chart.frameIntervalMs;
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
        chart.tickFps();
      }
      const minInterval = this.getMinFrameIntervalMs();
      if (now - this.lastFrameTime < minInterval - THROTTLE_TOLERANCE_MS) {
        this.animationFrameId = requestAnimationFrame(frame);
        return;
      }
      this.lastFrameTime = now;
      this.fpsMeter.tick(now, minInterval);
      this.renderAllCharts();
      this.animationFrameId = requestAnimationFrame(frame);
    };
    this.animationFrameId = requestAnimationFrame(frame);
  }

  private stopAnimationLoop(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
  }

  private renderAllCharts(): void {
    for (const chart of this.charts) {
      chart.update();
      if (chart.width === 0 || chart.height === 0) {
        continue;
      }
      const plotArea = chart.prepareFrame();
      if (!isNil(plotArea)) {
        this.renderChart(chart, plotArea);
      }
    }
  }

  /**
   * Render → resolve → copy into the offscreen canvas texture inside one
   * command encoder, then hand the bitmap to the chart. The copy is the
   * "timeseries offscreen blit" entry in CLAUDE.md's Known Architectural
   * Debt: it keeps iOS Safari from capturing a stale frame.
   */
  private renderChart(chart: ITimeseriesChart, plotArea: IPlotArea): void {
    const { width, height } = chart;
    // `transferToImageBitmap` detaches the backing store, so the context is reconfigured per frame.
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
        usage: OFFSCREEN_USAGE,
      });
      this.needsReconfigure = false;
    }

    const renderTarget = this.renderTargetPool.acquire(this.device, width, height, this.format);
    const msaaView = this.msaaManager.ensureView(this.device, this.format, width, height);
    if (isNil(msaaView)) {
      this.renderTargetPool.release(renderTarget);
      return;
    }

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: renderTarget.createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });
    chart.recordDrawCalls(
      pass,
      plotArea,
      this.debugMode ? this.resources.debugPipeline : undefined
    );
    pass.end();
    encoder.copyTextureToTexture(
      { texture: renderTarget },
      { texture: this.context.getCurrentTexture() },
      [width, height]
    );
    this.device.queue.submit([encoder.finish()]);
    this.renderTargetPool.release(renderTarget);

    const image = this.offscreen.transferToImageBitmap();
    this.needsReconfigure = true;
    chart.presentFrame(image);
    image.close();
  }
}
