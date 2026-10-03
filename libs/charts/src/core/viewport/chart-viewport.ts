import type { AxisViewport } from './axis-viewport';

/** The axes of a chart as one thing to move: the X axis and every value scale, each an `AxisViewport`. */
export interface IChartViewport<TX> {
  readonly x: AxisViewport<TX>;
  /** The viewport of the value scale of the given id; a chart is only ever asked for scales it has. */
  scale(id: string): AxisViewport<number>;
  readonly scaleIds: readonly string[];
  /** Grows with every change of any axis: a frame built for one revision stays valid until the next. */
  readonly revision: number;
}
