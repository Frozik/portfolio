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

/**
 * Domain port for slot-based texture storage. Implemented by the
 * infrastructure SlotAllocator. Exposes only the pure, GPU-free surface
 * the domain block pipeline depends on (allocate, write, touch), keeping
 * the domain layer free of GPU types.
 */
export interface ISlotAllocator {
  allocateSlot(): ITextureSlot | null;
  writeSlotData(slot: ITextureSlot, encoded: Float32Array, pointCount: number): void;
  touch(slot: ITextureSlot): void;
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
  tick(): void;
  getFrameIntervalMs(): number;
  getCurrentFps(): number;
}
