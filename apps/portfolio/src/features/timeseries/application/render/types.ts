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
  /**
   * Records the pass that draws grid and series straight into the chart's own
   * canvas, and repaints the 2D overlay above it. `multisampleView` must have
   * the chart's `width` × `height`.
   */
  renderFrame(frame: ITimeseriesFrame): void;
  dispose(): void;
}

export interface ITimeseriesFrame {
  readonly encoder: GPUCommandEncoder;
  readonly multisampleView: GPUTextureView;
  readonly plotArea: IPlotArea;
  /** Set while the debug overlay asks for the data block boundaries. */
  readonly debugPipeline: GPURenderPipeline | undefined;
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
