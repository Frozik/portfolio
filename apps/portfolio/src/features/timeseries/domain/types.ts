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

/** Slot-based texture storage as the block pipeline sees it: no GPU types cross this port. */
export interface ISlotAllocator {
  /** `undefined` when the texture is full and nothing can be evicted. */
  allocateSlot(): ITextureSlot | undefined;
  writeSlotData(slot: ITextureSlot, encoded: Float32Array, pointCount: number): void;
  touch(slot: ITextureSlot): void;
}

export interface IBlockEntry {
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
  readonly position: number;
  readonly label: string;
}

export interface IDataPoint {
  readonly time: number;
  readonly value: number;
  readonly size: number;
  readonly color: number;
}

/** `view*` is what is drawn; `target*` is where a zoom animation is heading. */
export interface IChartViewport {
  readonly viewTimeStart: number;
  readonly viewTimeEnd: number;
  readonly targetTimeStart: number;
  readonly targetTimeEnd: number;
  readonly viewValueMin: number;
  readonly viewValueMax: number;
}

export interface IPlotArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
