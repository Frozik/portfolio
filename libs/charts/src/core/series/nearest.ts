import type { IAxisDomain } from '../viewport/axis-domain';
import { isBreakMarker } from './point-run';
import { lowerBound } from './search';
import type { IStyledRun } from './style-processor';

export interface INearestElement<TX> {
  readonly styled: IStyledRun<TX>;
  readonly index: number;
}

/** The element of the runs that stands nearest to a position along X, break markers aside; none when the runs are empty. */
export function nearestElement<TX>(
  domain: IAxisDomain<TX>,
  runs: readonly IStyledRun<TX>[],
  position: TX
): INearestElement<TX> | undefined {
  let nearest: INearestElement<TX> | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const styled of runs) {
    const { run } = styled;
    const after = lowerBound(domain, run.x, run.length, position);
    for (const index of [after - 2, after - 1, after, after + 1]) {
      if (index < 0 || index >= run.length || isBreakMarker(run, index)) {
        continue;
      }
      const distance = Math.abs(domain.diff(run.x[index], position));
      if (distance < nearestDistance) {
        nearest = { styled, index };
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}
