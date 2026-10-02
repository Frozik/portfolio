import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { TColumns } from '../../core/series/columns';
import type { TRun } from '../../core/series/point-run';
import { runOf } from '../../core/series/point-run';
import type { TShape } from '../../core/series/shape';
import { ColumnBuffer, sliceColumns } from './column-buffer';
import type { IInterval } from './interval';
import { intersection, intersects, TIME_MAX, TIME_MIN } from './interval';

interface ISegment {
  /** A new id whenever the elements change in any way but growing at the end: that is all a run may do and stay itself. */
  id: number;
  revision: number;
  start: bigint;
  end: bigint;
  buffer: ColumnBuffer;
  run: TRun<bigint> | undefined;
}

export interface ISegmentStoreOptions {
  readonly shape: TShape;
  /** Length of one element's interval, nanoseconds. */
  readonly step: number;
  /** Run ids, unique among everything one series may ever be handed. */
  readonly nextId: () => number;
}

/** Index of the first element later than `time`. */
function indexAfter(buffer: ColumnBuffer, time: bigint): number {
  let low = 0;
  let high = buffer.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (buffer.timeAt(middle) <= time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * What is known of one series at one shape and scale: intervals of time about
 * which everything is known, each with its elements. Intervals that touch are
 * one segment, so a line runs through them unbroken (§4.4).
 */
export class SegmentStore {
  private segments: ISegment[] = [];

  constructor(private readonly options: ISegmentStoreOptions) {}

  get covered(): readonly IInterval[] {
    return this.segments;
  }

  get elementCount(): number {
    return this.segments.reduce((sum, segment) => sum + segment.buffer.length, 0);
  }

  /** The time of the first element there ever was, once history has been read to its beginning. */
  get historyStart(): bigint | undefined {
    const first = this.segments.find(segment => segment.buffer.length > 0);
    return !isNil(first) && this.segments[0].start === TIME_MIN
      ? first.buffer.timeAt(0)
      : undefined;
  }

  get lastTime(): bigint | undefined {
    const last = this.segments.findLast(segment => segment.buffer.length > 0);
    return last?.buffer.timeAt(last.buffer.length - 1);
  }

  /** Everything in `interval` is now known: these elements and nothing else. */
  cover(interval: IInterval, columns: TColumns): void {
    assert(
      this.segments.every(segment => !intersects(segment, interval)),
      'an interval is covered once'
    );
    const left = this.segments.find(segment => segment.end + 1n === interval.start);
    const right = this.segments.find(segment => segment.start === interval.end + 1n);

    if (!isNil(left) && isNil(right)) {
      left.buffer.append(columns);
      left.end = interval.end;
      left.revision += 1;
      return;
    }
    const buffer = new ColumnBuffer(this.options.shape);
    for (const part of [left?.buffer.view(), columns, right?.buffer.view()]) {
      if (!isNil(part)) {
        buffer.append(part);
      }
    }
    this.segments = [
      ...this.segments.filter(segment => segment !== left && segment !== right),
      this.segmentOf(left?.start ?? interval.start, right?.end ?? interval.end, buffer),
    ].sort((first, second) => (first.start < second.start ? -1 : 1));
  }

  /** New elements at the live edge: the segment that runs to the end of time. */
  appendLive(columns: TColumns): void {
    const live = this.segments.at(-1);
    assert(!isNil(live) && live.end === TIME_MAX, 'live elements need an open live edge');
    live.buffer.append(columns);
    live.revision += 1;
  }

  /** Nothing later than `time` is known any more. */
  truncateAfter(time: bigint): void {
    this.segments = this.segments.flatMap(segment => {
      if (segment.end <= time) {
        return [segment];
      }
      if (segment.start > time) {
        return [];
      }
      const kept = indexAfter(segment.buffer, time);
      if (kept === segment.buffer.length) {
        segment.end = time;
        return [segment];
      }
      return [this.segmentOf(segment.start, time, this.sliceOf(segment.buffer, 0, kept))];
    });
  }

  /**
   * Forgets what lies outside `keep` to free memory. The live edge stays
   * open: of a live segment at least the latest time is kept. Says whether
   * anything was forgotten.
   */
  trim(keep: IInterval): boolean {
    let forgotten = false;
    this.segments = this.segments.flatMap(segment => {
      const kept =
        segment.end === TIME_MAX ? this.liveKept(segment, keep) : intersection(segment, keep);
      if (!isNil(kept) && kept.start === segment.start && kept.end === segment.end) {
        return [segment];
      }
      forgotten = true;
      if (isNil(kept)) {
        return [];
      }
      const from = kept.start === TIME_MIN ? 0 : indexAfter(segment.buffer, kept.start - 1n);
      const to = indexAfter(segment.buffer, kept.end);
      return [this.segmentOf(kept.start, kept.end, this.sliceOf(segment.buffer, from, to))];
    });
    return forgotten;
  }

  clear(): void {
    this.segments = [];
  }

  /** The segments with elements that reach into `interval`, as runs. */
  runsIn(interval: IInterval): readonly TRun<bigint>[] {
    const runs: TRun<bigint>[] = [];
    for (const segment of this.segments) {
      if (segment.buffer.length > 0 && intersects(segment, interval)) {
        if (segment.run?.revision !== segment.revision) {
          segment.run = runOf<bigint>(segment.buffer.view(), {
            id: segment.id,
            revision: segment.revision,
            step: this.options.step,
          });
        }
        runs.push(segment.run);
      }
    }
    return runs;
  }

  /** The elements known in `interval`, in order. */
  columnsIn(interval: IInterval): TColumns {
    const found = new ColumnBuffer(this.options.shape);
    for (const segment of this.segments) {
      if (intersects(segment, interval)) {
        found.append(sliceColumns(segment.buffer.view(), interval.start, interval.end));
      }
    }
    return found.view();
  }

  private liveKept(segment: ISegment, keep: IInterval): IInterval {
    const { buffer } = segment;
    if (buffer.length === 0) {
      return segment;
    }
    const latest = buffer.timeAt(buffer.length - 1);
    const wanted = keep.end < buffer.timeAt(0) ? latest : keep.start;
    const start = wanted > latest ? latest : wanted;
    return { start: start > segment.start ? start : segment.start, end: segment.end };
  }

  private sliceOf(buffer: ColumnBuffer, from: number, to: number): ColumnBuffer {
    const slice = new ColumnBuffer(this.options.shape);
    slice.append(buffer.view(), from, to);
    return slice;
  }

  private segmentOf(start: bigint, end: bigint, buffer: ColumnBuffer): ISegment {
    return { id: this.options.nextId(), revision: 0, start, end, buffer, run: undefined };
  }
}
