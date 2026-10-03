import { assert } from '@frozik/utils/assert/assert';

import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import type { TColumns } from './columns';
import type { TShape } from './shape';

/**
 * What the position of an aggregated element marks: the start of its interval
 * (`[x, x + step)`, as Binance and TradingView stamp bars) or its end
 * (`(x − step, x]`: a five-minute bar over 23:55–00:00 stamped 00:00).
 */
export type TAggregateTime = 'start' | 'end';

export const DEFAULT_AGGREGATE_TIME: TAggregateTime = 'start';

interface IRunHeader<TX> {
  readonly id: number;
  /** Grows whenever the run's elements change: the only thing a consumer needs to notice a change (§4.1). */
  readonly revision: number;
  readonly length: number;
  readonly x: ArrayLike<TX>;
  /** Length of one element's interval in axis units; none for data that is not aggregated. */
  readonly step: number | undefined;
  readonly aggregateTime: TAggregateTime;
  /**
   * Indices of the technical NaN elements that stand for a cut of the axis:
   * not data, never shown — only there so a line does not join the elements
   * on the two sides of the cut (sessions §6).
   */
  readonly breakMarkers: readonly number[];
}

export interface IPointRun<TX> extends IRunHeader<TX> {
  readonly shape: 'point';
  readonly value: Float64Array;
}

export interface ICandleRun<TX> extends IRunHeader<TX> {
  readonly shape: 'candle';
  readonly open: Float64Array;
  readonly min: Float64Array;
  readonly max: Float64Array;
  readonly close: Float64Array;
}

/** A contiguous piece of data of one shape, in columns. */
export type TRun<TX, TWanted extends TShape = TShape> = Extract<
  IPointRun<TX> | ICandleRun<TX>,
  { readonly shape: TWanted }
>;

export function isRunOf<TX, TWanted extends TShape>(
  run: TRun<TX>,
  shape: TWanted
): run is TRun<TX, TWanted> {
  return run.shape === shape;
}

export function rangeOfRun<TX>(run: TRun<TX>): IAxisRange<TX> {
  assert(run.length > 0, 'a run has at least one element');
  return { start: run.x[0], end: run.x[run.length - 1] };
}

export interface IRunIdentity {
  readonly id: number;
  readonly revision: number;
  readonly step: number | undefined;
  readonly aggregateTime: TAggregateTime;
}

/** Whether the element is a break marker: a technical gap no one is shown. */
export function isBreakMarker<TX>(run: TRun<TX>, index: number): boolean {
  return run.breakMarkers.includes(index);
}

/** The interval an aggregate at `x` covers: `[start, end)` counted from its position by the stamp. */
export function aggregateIntervalOf<TX>(
  domain: IAxisDomain<TX>,
  aggregateTime: TAggregateTime,
  step: number | undefined,
  x: TX
): IAxisRange<TX> {
  const length = step ?? 0;
  return aggregateTime === 'start'
    ? { start: x, end: domain.add(x, length) }
    : { start: domain.add(x, -length), end: x };
}

/** The interval an element of the run covers in axis units. */
export function elementIntervalOf<TX>(
  domain: IAxisDomain<TX>,
  run: TRun<TX>,
  index: number
): IAxisRange<TX> {
  return aggregateIntervalOf(domain, run.aggregateTime, run.step, run.x[index]);
}

/** Columns as a run: the columns are taken as they are, not copied. */
export function runOf<TX>(
  columns: TColumns,
  identity: IRunIdentity,
  breakMarkers: readonly number[] = []
): TRun<TX> {
  const x = columns.x as unknown as ArrayLike<TX>;
  return columns.shape === 'point'
    ? { ...identity, breakMarkers, shape: 'point', length: columns.length, x, value: columns.value }
    : {
        ...identity,
        breakMarkers,
        shape: 'candle',
        length: columns.length,
        x,
        open: columns.open,
        min: columns.min,
        max: columns.max,
        close: columns.close,
      };
}
