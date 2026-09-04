import type { IPlotArea } from '../../domain/types';
import type { ISharedGpuResources } from '../../infrastructure/shared-gpu-resources';

/** What the shared frame loop needs from one chart of the grid. */
export interface ITimeseriesChart {
  readonly width: number;
  readonly height: number;
  readonly frameIntervalMs: number;
  tickFps(): void;
  update(): void;
  /** `undefined` when there is nothing to draw and nothing loading. */
  prepareFrame(): IPlotArea | undefined;
  recordDrawCalls(
    pass: GPURenderPassEncoder,
    plotArea: IPlotArea,
    debugPipeline: GPURenderPipeline | undefined
  ): void;
  /** Paints the frame's GPU image between the grid below and the axes above it. */
  presentFrame(image: ImageBitmap): void;
  dispose(): void;
}

export interface ISharedTimeseriesRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly resources: ISharedGpuResources;
  readonly debugMode: boolean;
  readonly instantLoad: boolean;
  readonly renderFps: number;
  setDebugMode(enabled: boolean): void;
  setInstantLoad(enabled: boolean): void;
  registerChart(chart: ITimeseriesChart): VoidFunction;
  destroy(): void;
}
