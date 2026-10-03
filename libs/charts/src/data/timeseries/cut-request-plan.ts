import type { TAggregateTime } from '../../core/series/point-run';
import type { ICut } from '../../core/viewport/cut';

/** The bounds of a request, both given, in world time. */
export interface IRequestBounds {
  readonly from: bigint;
  readonly to: bigint;
  readonly includeFrom: boolean;
  readonly includeTo: boolean;
}

/** One request to the source: a stretch of the bounds, and the cuts inside it that the source may leave out. */
export interface IRequestPiece extends IRequestBounds {
  readonly skip: readonly ICut<bigint>[];
}

export interface IRequestPlanning {
  readonly step: bigint;
  readonly aggregateTime: TAggregateTime;
  /** How many needless elements one request is worth: a cut that would bring more than this splits the request (sessions §5.3). */
  readonly requestWorth: number;
}

/**
 * An element whose interval starts inside a cut and reaches out of it stays
 * (sessions §5.1), and lies up to one step inside the cut: a piece bounded by a
 * cut reaches that far into it, so the element is asked for.
 */
function reachOf({ step, aggregateTime }: IRequestPlanning): { before: bigint; after: bigint } {
  return aggregateTime === 'start' ? { before: 0n, after: step } : { before: step, after: 0n };
}

function clipped(bounds: IRequestBounds, cuts: readonly ICut<bigint>[]): readonly ICut<bigint>[] {
  return cuts.flatMap(cut => {
    const from = cut.from > bounds.from ? cut.from : bounds.from;
    const to = cut.to < bounds.to ? cut.to : bounds.to;
    return to > from ? [{ from, to }] : [];
  });
}

/**
 * How the bounds are asked for: as one request when the cuts inside them
 * would bring back little, or in pieces split at the cuts that would bring
 * back more than a request is worth — an open stretch shorter than that
 * stays joined to its neighbour rather than being a request of its own.
 */
export function piecesOf(
  bounds: IRequestBounds,
  cuts: readonly ICut<bigint>[],
  planning: IRequestPlanning
): readonly IRequestPiece[] {
  const worth = planning.step * BigInt(planning.requestWorth);
  const reach = reachOf(planning);
  const pieces: IRequestPiece[] = [];
  let start = bounds.from;
  let includeStart = bounds.includeFrom;
  let skip: ICut<bigint>[] = [];
  let splitAt: ICut<bigint> | undefined;
  for (const cut of clipped(bounds, cuts)) {
    if (cut.to - cut.from <= worth || cut.from - start < worth) {
      skip.push(cut);
      continue;
    }
    pieces.push({
      from: start,
      to: cut.from + reach.before,
      includeFrom: includeStart,
      includeTo: false,
      skip,
    });
    start = cut.to - reach.after;
    includeStart = false;
    skip = [];
    splitAt = cut;
  }
  const last = pieces.at(-1);
  if (last !== undefined && splitAt !== undefined && bounds.to - start < worth) {
    pieces[pieces.length - 1] = {
      ...last,
      to: bounds.to,
      includeTo: bounds.includeTo,
      skip: [...last.skip, splitAt, ...skip],
    };
    return pieces;
  }
  pieces.push({
    from: start,
    to: bounds.to,
    includeFrom: includeStart,
    includeTo: bounds.includeTo,
    skip,
  });
  return pieces;
}
