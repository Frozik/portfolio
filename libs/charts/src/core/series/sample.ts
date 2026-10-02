import type { TRun } from './point-run';

/** One element as style functions see it, whatever its shape: for a point all four values are its value. */
export interface ISample<TX> {
  readonly x: TX;
  /** The point's value; a candle's close. */
  readonly value: number;
  readonly open: number;
  readonly min: number;
  readonly max: number;
  readonly close: number;
}

export function sampleAt<TX>(run: TRun<TX>, index: number): ISample<TX> {
  const x = run.x[index];
  if (run.shape === 'candle') {
    const close = run.close[index];
    return {
      x,
      value: close,
      open: run.open[index],
      min: run.min[index],
      max: run.max[index],
      close,
    };
  }
  const value = run.value[index];
  return { x, value, open: value, min: value, max: value, close: value };
}
