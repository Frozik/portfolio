import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TColumns } from '../../core/series/columns';
import { axisColumnOf, positionsOf } from '../../core/series/columns';
import type { TAggregateTime } from '../../core/series/point-run';
import type { IAxisDomain } from '../../core/viewport/axis-domain';
import type { IAxisMapping } from '../../core/viewport/axis-mapping';

export interface ICutting<TX> {
  readonly domain: IAxisDomain<TX>;
  readonly mapping: IAxisMapping<TX>;
  /** Length of one element's interval in axis units; none for data that is not aggregated. */
  readonly step: number | undefined;
  readonly aggregateTime: TAggregateTime;
}

/** Whether anything of the element's interval is left once the cuts are taken out (sessions §5.1). */
function isShown<TX>({ domain, mapping, step, aggregateTime }: ICutting<TX>, x: TX): boolean {
  if (step === undefined || step === 0) {
    return !mapping.isCut(x);
  }
  const other = domain.add(x, aggregateTime === 'start' ? step : -step);
  return domain.compare(mapping.toVirtual(other), mapping.toVirtual(x)) !== 0;
}

function pick(column: Float64Array, kept: readonly number[]): Float64Array {
  const picked = new Float64Array(kept.length);
  kept.forEach((index, order) => {
    picked[order] = column[index];
  });
  return picked;
}

/**
 * Columns handed over by a source, as the chart keeps them: positions in the
 * virtual coordinate, and only the elements that have anything left to show
 * — an element lying wholly inside a cut is dropped, one that reaches out of
 * it stays (sessions §5).
 */
export function cutColumns<TX>(cutting: ICutting<TX>, columns: TColumns): TColumns {
  const positions = positionsOf<TX>(columns.x);
  const kept: number[] = [];
  for (let index = 0; index < columns.length; index += 1) {
    if (isShown(cutting, positions[index])) {
      kept.push(index);
    }
  }
  // An empty column keeps the kind of the one it came from: nothing in it says which axis it is on.
  const x =
    kept.length === 0
      ? columns.x.slice(0, 0)
      : axisColumnOf(kept.map(index => cutting.mapping.toVirtual(positions[index])));
  switch (columns.shape) {
    case 'point':
      return { shape: 'point', length: kept.length, x, value: pick(columns.value, kept) };
    case 'candle':
      return {
        shape: 'candle',
        length: kept.length,
        x,
        open: pick(columns.open, kept),
        min: pick(columns.min, kept),
        max: pick(columns.max, kept),
        close: pick(columns.close, kept),
      };
    default:
      return assertNever(columns);
  }
}
