import { assert } from '@frozik/utils/assert/assert';
import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import { FpsMeter } from '@frozik/utils/webgpu/fpsMeter';
import { MsaaTextureCache } from '@frozik/utils/webgpu/msaaTextureCache';
import { isNil } from 'lodash-es';

import { FPS_IDLE, MSAA_SAMPLE_COUNT } from '../../domain/constants';
import type { ISharedGpuResources } from '../../infrastructure/shared-gpu-resources';
import { createSharedGpuResources } from '../../infrastructure/shared-gpu-resources';
import type { ISharedTimeseriesRenderer, ITimeseriesChart } from './types';

const THROTTLE_TOLERANCE_MS = 2;

export async function createSharedRenderer(): Promise<ISharedTimeseriesRenderer> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');
  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat();

  return new SharedTimeseriesRenderer(device, format, createSharedGpuResources(device, format));
}

/** One device, one set of pipelines and one frame loop drawing into the canvas of every chart. */
class SharedTimeseriesRenderer implements ISharedTimeseriesRenderer {
  debugMode = false;
  instantLoad = true;
  renderFps = 0;

  private readonly charts = new Set<ITimeseriesChart>();
  private readonly multisampleTextures: MsaaTextureCache;
  private readonly fpsMeter = new FpsMeter({
    onUpdate: fps => {
      this.renderFps = fps;
    },
  });
  private animationFrameId = 0;
  private lastFrameTime = 0;
  private disposed = false;

  constructor(
    readonly device: GPUDevice,
    readonly format: GPUTextureFormat,
    readonly resources: ISharedGpuResources
  ) {
    this.multisampleTextures = new MsaaTextureCache(device, format, MSAA_SAMPLE_COUNT);
  }

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
    this.multisampleTextures.dispose();
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

  /** Every chart records its pass into one encoder, so the whole grid is one submission. */
  private renderAllCharts(): void {
    const encoder = this.device.createCommandEncoder();
    const debugPipeline = this.debugMode ? this.resources.debugPipeline : undefined;

    for (const chart of this.charts) {
      chart.update();
      if (chart.width === 0 || chart.height === 0) {
        continue;
      }
      const plotArea = chart.prepareFrame();
      if (isNil(plotArea)) {
        continue;
      }
      chart.renderFrame({
        encoder,
        multisampleView: this.multisampleTextures.acquireView(chart.width, chart.height),
        plotArea,
        debugPipeline,
      });
    }

    this.device.queue.submit([encoder.finish()]);
    this.multisampleTextures.sweepUnused();
  }
}
