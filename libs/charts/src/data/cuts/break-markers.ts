import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { TAxisColumn, TColumns } from '../../core/series/columns';
import { axisColumnOf } from '../../core/series/columns';
import type { TRun } from '../../core/series/point-run';
import { aggregateIntervalOf, runOf } from '../../core/series/point-run';
import type { IAxisDomain, IAxisRange } from '../../core/viewport/axis-domain';
import type { IAxisMapping, ICutInView, TCutEdge } from '../../core/viewport/axis-mapping';

/**
 * Whether the cut lies wholly between the intervals of two neighbours and the
 * elements are shorter than the open stretch before it: the time missing
 * between them was time they would have covered (sessions §5.1, rule 3).
 */
function breaksBetween<TX>(
  domain: IAxisDomain<TX>,
  step: number | undefined,
  before: IAxisRange<TX>,
  after: IAxisRange<TX>,
  cut: ICutInView<TX>
): boolean {
  if (!isNil(cut.openBefore) && (step ?? 0) >= cut.openBefore) {
    return false;
  }
  return domain.compare(before.end, cut.from) <= 0 && domain.compare(cut.to, after.start) <= 0;
}

/**
 * The world position of a virtual one next to a cut, with no other cut
 * between them: the distance to the cut is the same on both axes. On the cut
 * itself it is the edge asked for, as `toWorld` would give.
 */
function worldBeside<TX>(
  domain: IAxisDomain<TX>,
  virtual: TX,
  cut: ICutInView<TX>,
  edge: TCutEdge
): TX {
  const side = domain.compare(virtual, cut.at);
  if (side === 0) {
    return edge === 'after' ? cut.to : cut.from;
  }
  return domain.plus(side < 0 ? cut.from : cut.to, domain.minus(virtual, cut.at));
}

/** A break: the element the run breaks before, and where the marker stands. */
export interface IBreak<TX> {
  readonly before: number;
  readonly at: TX;
}

/**
 * The cuts that break the run before the elements `from` up to `to`, each
 * with the element it breaks before. Elements and cuts are both in order, so
 * one walk over both finds every cut between two neighbours, and the
 * neighbours' world intervals come from the cuts beside them without a lookup.
 */
export function breaksOf<TX>(
  domain: IAxisDomain<TX>,
  mapping: IAxisMapping<TX>,
  run: TRun<TX>,
  from = 1,
  to = run.length
): readonly IBreak<TX>[] {
  const breaks: IBreak<TX>[] = [];
  if (to <= from) {
    return breaks;
  }
  const { step, aggregateTime } = run;
  const edge: TCutEdge = aggregateTime === 'start' ? 'after' : 'before';
  const intervalAt = (virtual: TX, beside: ICutInView<TX>): IAxisRange<TX> =>
    aggregateIntervalOf(domain, aggregateTime, step, worldBeside(domain, virtual, beside, edge));
  const cuts = mapping.cutsIn({ start: run.x[from - 1], end: run.x[to - 1] });
  let first = 0;
  for (let index = from; index < to && first < cuts.length; index += 1) {
    const left = run.x[index - 1];
    const right = run.x[index];
    while (first < cuts.length && domain.compare(cuts[first].at, left) < 0) {
      first += 1;
    }
    let last = first;
    while (last < cuts.length && domain.compare(cuts[last].at, right) <= 0) {
      last += 1;
    }
    if (last === first) {
      continue;
    }
    const before = intervalAt(left, cuts[first]);
    const after = intervalAt(right, cuts[last - 1]);
    for (let at = first; at < last; at += 1) {
      if (breaksBetween(domain, step, before, after, cuts[at])) {
        breaks.push({ before: index, at: cuts[at].at });
        break;
      }
    }
  }
  return breaks;
}

interface ISplicable<TSelf, TItem> {
  readonly length: number;
  subarray(begin: number, end?: number): TSelf;
  set(values: TSelf, offset: number): void;
  [index: number]: TItem;
}

/** The column with an item put in before every element a break names; the stretches between are copied whole. */
function spliced<TItem, TColumn extends ISplicable<TColumn, TItem>>(
  column: TColumn,
  make: (length: number) => TColumn,
  breaks: readonly IBreak<unknown>[],
  itemOf: (at: unknown) => TItem
): TColumn {
  const marked = make(column.length + breaks.length);
  let source = 0;
  let target = 0;
  for (const { before, at } of breaks) {
    marked.set(column.subarray(source, before), target);
    target += before - source;
    marked[target] = itemOf(at);
    target += 1;
    source = before;
  }
  marked.set(column.subarray(source), target);
  return marked;
}

function withMarkers(column: Float64Array, breaks: readonly IBreak<unknown>[]): Float64Array {
  return spliced(
    column,
    length => new Float64Array(length),
    breaks,
    () => Number.NaN
  );
}

/** The axis column with the position of every break put in before the element it names. */
function withBreakPositions(column: TAxisColumn, breaks: readonly IBreak<unknown>[]): TAxisColumn {
  return column instanceof BigInt64Array
    ? spliced(
        column,
        length => new BigInt64Array(length),
        breaks,
        at => {
          assert(typeof at === 'bigint', 'a time axis is positioned by bigints');
          return at;
        }
      )
    : spliced(
        column,
        length => new Float64Array(length),
        breaks,
        at => {
          assert(typeof at === 'number', 'a numeric axis is positioned by numbers');
          return at;
        }
      );
}

/**
 * The run with a technical NaN element at every break, so a line, a stair or
 * an area does not join the elements on its two sides. The markers are not
 * data: `breakMarkers` names them, and whatever shows elements to the user
 * skips them (sessions §6).
 */
export function markedWith<TX>(run: TRun<TX>, breaks: readonly IBreak<TX>[]): TRun<TX> {
  if (breaks.length === 0) {
    return run;
  }
  const length = run.length + breaks.length;
  // A run's positions are a typed array under the generic type: taken as they are, not copied.
  const x = withBreakPositions(axisColumnOf(run.x), breaks);
  const columns: TColumns =
    run.shape === 'point'
      ? { shape: 'point', length, x, value: withMarkers(run.value, breaks) }
      : {
          shape: 'candle',
          length,
          x,
          open: withMarkers(run.open, breaks),
          min: withMarkers(run.min, breaks),
          max: withMarkers(run.max, breaks),
          close: withMarkers(run.close, breaks),
        };
  const { id, revision, step, aggregateTime } = run;
  const markers = breaks.map(({ before }, order) => before + order);
  return runOf<TX>(columns, { id, revision, step, aggregateTime }, markers);
}

/** The run with a technical NaN element at every cut that breaks it. */
export function markBreaks<TX>(
  domain: IAxisDomain<TX>,
  mapping: IAxisMapping<TX>,
  run: TRun<TX>
): TRun<TX> {
  return run.length === 0 ? run : markedWith(run, breaksOf(domain, mapping, run));
}
