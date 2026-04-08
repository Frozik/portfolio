export enum ETimeScale {
  Year = 0,
  Month = 1,
  Week = 2,
  Day = 3,
  Hour = 4,
  Minute = 5,
}

export interface IDataPart {
  scale: ETimeScale;
  timeStart: number;
  timeEnd: number;
  baseTime: number;
  baseValue: number;
  textureRowStart: number;
  pointCount: number;
  valueMin: number;
  valueMax: number;
  /** CPU-side copy of point times and values for visible-range Y auto-scaling. */
  pointTimes: Float64Array;
  pointValues: Float64Array;
}

export interface ISpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  part: IDataPart;
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

export interface IDrawCommands {
  lineBindGroup: GPUBindGroup;
  lineInstanceCount: number;
  candlestickBindGroup: GPUBindGroup;
  candlestickInstanceCount: number;
  plotArea: IPlotArea;
}

export interface ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
  readonly gridSvg: SVGSVGElement;
  readonly axesSvg: SVGSVGElement;
  readonly width: number;
  readonly height: number;
  readonly isActive: boolean;
  update(): void;
  prepareDrawCommands(): IDrawCommands | null;
  renderOverlay(): void;
  dispose(): void;
}

export interface ISharedTimeseriesRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly linePipeline: GPURenderPipeline;
  readonly candlestickPipeline: GPURenderPipeline;
  registerChart(chart: ITimeseriesChart): VoidFunction;
  destroy(): void;
}
