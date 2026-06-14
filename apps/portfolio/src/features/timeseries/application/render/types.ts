import type { IFpsController, ILoadingRegion, IPlotArea } from '../../domain/types';
import type { ISeriesLayerManager } from '../../infrastructure/layers/types';

export interface ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly fpsController: IFpsController;
  readonly seriesManager: ISeriesLayerManager;
  syncCanvasSize(): boolean;
  update(): void;
  prepareDrawCommands(): IPlotArea | null;
  getLoadingRegions(): ILoadingRegion[];
  getViewport(): { timeStart: number; timeEnd: number };
  renderCanvasGrid(): void;
  renderCanvasAxes(): void;
  dispose(): void;
}

export interface ISharedTimeseriesRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly linePipeline: GPURenderPipeline;
  readonly candlestickPipeline: GPURenderPipeline;
  readonly rhombusPipeline: GPURenderPipeline;
  readonly debugPipeline: GPURenderPipeline;
  debugMode: boolean;
  instantLoad: boolean;
  readonly renderFps: number;
  registerChart(chart: ITimeseriesChart): VoidFunction;
  destroy(): void;
}
