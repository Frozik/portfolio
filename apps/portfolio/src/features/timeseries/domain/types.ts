export enum ETimeScale {
  Hour1 = 3600,
  Hour12 = 43200,
  Day1 = 86400,
  Day4 = 345600,
  Day16 = 1382400,
  Day64 = 5529600,
  Day256 = 22118400,
}

export enum EChartType {
  Line = 0,
  Candlestick = 1,
  Rhombus = 2,
}

export type PointTransformFunction = (
  value: number,
  index: number,
  points: readonly IDataPoint[]
) => number;

export interface ISeriesConfig {
  readonly chartType: EChartType;
  readonly seedSuffix: string;
  readonly colorFn?: PointTransformFunction;
  readonly sizeFn?: PointTransformFunction;
}

export interface ILoadingRegion {
  readonly timeStart: number;
  readonly timeEnd: number;
  readonly progress: number;
}

export interface ITextureSlot {
  readonly row: number;
  readonly slotIndex: number;
}

export interface IBlockEntry {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;

  readonly timeStart: number;
  readonly timeEnd: number;
  readonly scale: ETimeScale;
  readonly chartType: EChartType;
  readonly slot: ITextureSlot;
  readonly pointCount: number;
  readonly baseTime: number;
  readonly baseValue: number;
  readonly pointTimes: Float64Array;
  readonly pointValues: Float64Array;
}

export interface IAxisTick {
  position: number;
  label: string;
}

export interface IDataPoint {
  time: number;
  value: number;
  size: number;
  color: number;
}

export interface IChartViewport {
  viewTimeStart: number;
  viewTimeEnd: number;
  targetTimeStart: number;
  targetTimeEnd: number;
  viewValueMin: number;
  viewValueMax: number;
}

export interface IPlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IFpsController {
  getFrameIntervalMs(): number;
  getCurrentFps(): number;
}

export interface ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
  readonly canvasGpuContext: GPUCanvasContext | null;
  readonly axesSvg: SVGSVGElement;
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
  renderOverlay(): void;
  dispose(): void;
}

export interface ISeriesLayer {
  init(gpuDevice: GPUDevice, layout: GPUBindGroupLayout, slotAllocator: unknown): void;
  updateBindGroup(dataTextureView: GPUTextureView): void;
  writeUniforms(
    blocks: ReadonlyArray<IBlockEntry>,
    canvasWidth: number,
    canvasHeight: number,
    viewTimeStart: number,
    viewTimeEnd: number,
    viewValueMin: number,
    viewValueMax: number
  ): void;
  render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, plotArea: IPlotArea): void;
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void;
  readonly instanceCount: number;
  readonly bindGroup: GPUBindGroup | null;
  dispose(): void;
}

export interface ISeriesLayerManager {
  renderAll(pass: GPURenderPassEncoder, plotArea: IPlotArea): void;
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void;
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
  readonly renderFps: number;
  registerChart(chart: ITimeseriesChart): VoidFunction;
  destroy(): void;
}
