import { assert } from '@frozik/utils/assert/assert';

import type { IAxisRange } from '../viewport/axis-domain';
import type { TColumns } from './columns';
import type { TShape } from './shape';

interface IRunHeader<TX> {
  readonly id: number;
  /** Grows whenever the run's elements change: the only thing a consumer needs to notice a change (§4.1). */
  readonly revision: number;
  readonly length: number;
  readonly x: ArrayLike<TX>;
  /** Length of one element's interval in axis units; none for data that is not aggregated. */
  readonly step: number | undefined;
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
}

/** Columns as a run: the columns are taken as they are, not copied. */
export function runOf<TX>(columns: TColumns, identity: IRunIdentity): TRun<TX> {
  const x = columns.x as unknown as ArrayLike<TX>;
  return columns.shape === 'point'
    ? { ...identity, shape: 'point', length: columns.length, x, value: columns.value }
    : {
        ...identity,
        shape: 'candle',
        length: columns.length,
        x,
        open: columns.open,
        min: columns.min,
        max: columns.max,
        close: columns.close,
      };
}
