export interface IChartSize {
  /** Device pixels. */
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

export interface ISizeSource {
  /** The size of the chart right now; read once a frame. */
  measure(): IChartSize;
}

export function isSameSize(first: IChartSize, second: IChartSize): boolean {
  return (
    first.width === second.width &&
    first.height === second.height &&
    first.devicePixelRatio === second.devicePixelRatio
  );
}
