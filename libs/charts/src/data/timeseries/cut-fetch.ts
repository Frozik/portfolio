import { isNil } from 'lodash-es';

import type { TColumns } from '../../core/series/columns';
import { columnsOf, positionsOf } from '../../core/series/columns';
import { concatColumns } from '../../core/series/concat-columns';
import type { TAggregateTime } from '../../core/series/point-run';
import type { IAxisDomain } from '../../core/viewport/axis-domain';
import type { IAxisMapping } from '../../core/viewport/axis-mapping';
import type { ICut } from '../../core/viewport/cut';
import type { ICutting } from '../cuts/cut-columns';
import { cutColumns } from '../cuts/cut-columns';
import { emptyColumns, sliceColumns } from './column-buffer';
import { piecesOf } from './cut-request-plan';
import { TIME_MAX, TIME_MIN } from './interval';
import type { IFetchRequest, ITimeseriesSource, TFetchDirection } from './source';

/** A stretch of a request, open at either end when the request is. */
interface IPiece extends Pick<IFetchRequest, 'from' | 'to' | 'includeFrom' | 'includeTo'> {
  readonly skip: readonly ICut<bigint>[];
}

export interface ICutFetching {
  readonly source: ITimeseriesSource;
  readonly domain: IAxisDomain<bigint>;
  readonly mapping: IAxisMapping<bigint>;
  readonly aggregateTime: TAggregateTime;
  /** How many needless elements one request is worth: a cut that would bring more than this splits the request (sessions §5.3). */
  readonly requestWorth: number;
}

/**
 * An element that starts inside a cut and runs out of it stands at the cut
 * point, where an earlier answer may have ended: the world request reaches
 * back to the cut's start and brings it again, so the answer is held to the
 * virtual bounds asked for, excluded ends and all.
 */
function withinBounds(columns: TColumns, request: IFetchRequest): TColumns {
  const { from, to, includeFrom, includeTo } = request;
  const start = isNil(from) ? TIME_MIN : includeFrom ? from : from + 1n;
  const end = isNil(to) ? TIME_MAX : includeTo ? to : to - 1n;
  return sliceColumns(columns, start, end);
}

/**
 * One fetch in virtual time carried out against the source in world time:
 * split at the cuts worth splitting at, piece after piece in the direction
 * asked, an answer the limit stopped short asked on from where it ended,
 * until the limit is reached or the bounds are. Once a source shows that it
 * leaves the `skip` stretches out by itself, the bounds go in one request
 * from then on (sessions §5.3).
 */
export class CutFetcher {
  private honoursSkip = false;

  constructor(private readonly fetching: ICutFetching) {}

  async fetch(request: IFetchRequest): Promise<TColumns> {
    const { domain, mapping, aggregateTime } = this.fetching;
    const cutting: ICutting<bigint> = {
      domain,
      mapping,
      step: Number(request.scale),
      aggregateTime,
    };
    const queue = this.piecesFor(request);
    const collected: TColumns[] = [];
    let count = 0;
    while (queue.length > 0 && count < request.softLimit) {
      const piece = queue.shift();
      if (isNil(piece)) {
        break;
      }
      const asked = this.askedFor(request.softLimit - count, piece);
      const answer = columnsOf(
        await this.fetching.source.fetch({
          ...request,
          ...piece,
          softLimit: asked,
          skip: piece.skip,
        })
      );
      this.learnFrom(piece, answer, request.direction);
      const kept = withinBounds(cutColumns(cutting, answer), request);
      collected.push(kept);
      count += kept.length;
      const rest = this.restOf(piece, answer, asked, request.direction);
      if (!isNil(rest)) {
        queue.unshift(rest);
      }
    }
    if (request.direction === 'backward') {
      collected.reverse();
    }
    return collected.length === 0 ? emptyColumns(request.shape) : concatColumns(collected);
  }

  /** The pieces in the order they are asked in: from the near end of the direction. */
  private piecesFor(request: IFetchRequest): IPiece[] {
    const { mapping } = this.fetching;
    const bounds = {
      from: isNil(request.from) ? undefined : mapping.toWorld(request.from, 'before'),
      to: isNil(request.to) ? undefined : mapping.toWorld(request.to, 'after'),
      includeFrom: request.includeFrom,
      includeTo: request.includeTo,
    };
    const { from, to } = bounds;
    if (isNil(from) || isNil(to) || isNil(request.from) || isNil(request.to)) {
      return [{ ...bounds, skip: [] }];
    }
    const cuts = mapping.cutsIn({ start: request.from, end: request.to });
    const whole = { ...bounds, from, to };
    const pieces: IPiece[] = this.honoursSkip
      ? [{ ...whole, skip: cuts.map(cut => ({ from: cut.from, to: cut.to })) }]
      : [
          ...piecesOf(whole, cuts, {
            step: request.scale,
            aggregateTime: this.fetching.aggregateTime,
            requestWorth: this.fetching.requestWorth,
          }),
        ];
    return request.direction === 'forward' ? pieces : pieces.reverse();
  }

  /**
   * How many elements a piece is asked for so that, after the cuts, the
   * missing ones come: never fewer than a request is worth, else an answer
   * the limit stopped inside a cut would be asked on a handful at a time —
   * and fewer than the limit given back must mean the bounds were read whole.
   */
  private askedFor(missing: number, piece: IPiece): number {
    return Math.ceil(Math.max(missing, this.fetching.requestWorth) / this.openShareOf(piece));
  }

  /** The share of a piece that is left once the cuts are taken out: what one element of its answer is worth. */
  private openShareOf(piece: IPiece): number {
    const { mapping } = this.fetching;
    if (isNil(piece.from) || isNil(piece.to)) {
      return 1;
    }
    const world = Number(piece.to - piece.from);
    const virtual = Number(mapping.toVirtual(piece.to) - mapping.toVirtual(piece.from));
    return world > 0 ? Math.max(virtual / world, Number.EPSILON) : 1;
  }

  /** A source that answered past the stretches to skip with nothing inside them knows the schedule. */
  private learnFrom(piece: IPiece, answer: TColumns, direction: TFetchDirection): void {
    if (this.honoursSkip || piece.skip.length === 0 || answer.length === 0) {
      return;
    }
    const times = positionsOf<bigint>(answer.x);
    const first = times[0];
    const last = times[answer.length - 1];
    const reached =
      direction === 'forward'
        ? last >= piece.skip[piece.skip.length - 1].to
        : first <= piece.skip[0].from;
    if (!reached) {
      return;
    }
    const inside = (cut: ICut<bigint>, time: bigint): boolean => time > cut.from && time < cut.to;
    for (let index = 0; index < answer.length; index += 1) {
      if (piece.skip.some(cut => inside(cut, times[index]))) {
        return;
      }
    }
    this.honoursSkip = true;
  }

  /** What is left of a piece the limit stopped short of, from the last element given; nothing when the piece was read whole. */
  private restOf(
    piece: IPiece,
    answer: TColumns,
    asked: number,
    direction: TFetchDirection
  ): IPiece | undefined {
    if (answer.length < asked) {
      return undefined;
    }
    const times = positionsOf<bigint>(answer.x);
    if (direction === 'forward') {
      const last = times[answer.length - 1];
      return isNil(piece.to) || last < piece.to
        ? {
            ...piece,
            from: last,
            includeFrom: false,
            skip: piece.skip.filter(cut => cut.to > last),
          }
        : undefined;
    }
    const first = times[0];
    return isNil(piece.from) || first > piece.from
      ? { ...piece, to: first, includeTo: false, skip: piece.skip.filter(cut => cut.from < first) }
      : undefined;
  }
}
