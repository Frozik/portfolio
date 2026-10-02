import type { TRun } from './point-run';
import type { ISample } from './sample';
import { sampleAt } from './sample';

/** A constant, or a function of the element, its index and its run. */
export type TPaintSource<TX = unknown> =
  | number
  | ((sample: ISample<TX>, index: number, run: TRun<TX>) => number);

export function colorsOf<TX>(run: TRun<TX>, source: TPaintSource<TX>): number | Uint32Array {
  if (typeof source === 'number') {
    return source;
  }
  const colors = new Uint32Array(run.length);
  for (let index = 0; index < run.length; index += 1) {
    colors[index] = source(sampleAt(run, index), index, run);
  }
  return colors;
}

export function sizesOf<TX>(run: TRun<TX>, source: TPaintSource<TX>): number | Float32Array {
  if (typeof source === 'number') {
    return source;
  }
  const sizes = new Float32Array(run.length);
  for (let index = 0; index < run.length; index += 1) {
    sizes[index] = source(sampleAt(run, index), index, run);
  }
  return sizes;
}
