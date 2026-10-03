import { isNil } from 'lodash-es';

import type { TRun } from '../../core/series/point-run';
import type { IAxisDomain } from '../../core/viewport/axis-domain';
import type { IAxisMapping } from '../../core/viewport/axis-mapping';
import type { IBreak } from './break-markers';
import { breaksOf, markedWith } from './break-markers';

interface IMarkedRun<TX> {
  readonly source: TRun<TX>;
  readonly breaks: readonly IBreak<TX>[];
  readonly marked: TRun<TX>;
}

/**
 * Marked runs, kept while the run's revision stands: markers are placed once
 * per revision, not per frame. A run that grew from one already marked —
 * elements appended by a fill or the live edge, or put in front of it by a
 * fill of history — is marked only where it is new, whatever its id.
 */
export class BreakMarking<TX> {
  private readonly marked = new Map<number, IMarkedRun<TX>>();

  constructor(
    private readonly domain: IAxisDomain<TX>,
    private readonly mapping: IAxisMapping<TX> | undefined
  ) {}

  of(runs: readonly TRun<TX>[]): readonly TRun<TX>[] {
    const { mapping } = this;
    if (isNil(mapping)) {
      return runs;
    }
    const live = new Set<number>();
    const result = runs.map(run => {
      live.add(run.id);
      const cached = this.marked.get(run.id);
      if (!isNil(cached) && cached.source.revision === run.revision) {
        return cached.marked;
      }
      const breaks = run.length === 0 ? [] : this.breaksOf(mapping, run);
      const entry = { source: run, breaks, marked: markedWith(run, breaks) };
      this.marked.set(run.id, entry);
      return entry.marked;
    });
    for (const id of this.marked.keys()) {
      if (!live.has(id)) {
        this.marked.delete(id);
      }
    }
    return result;
  }

  private breaksOf(mapping: IAxisMapping<TX>, run: TRun<TX>): readonly IBreak<TX>[] {
    const { domain } = this;
    for (const known of this.marked.values()) {
      const { source, breaks } = known;
      if (source.length === 0 || source.length > run.length) {
        continue;
      }
      if (this.isPrefix(source, run)) {
        return [...breaks, ...breaksOf(domain, mapping, run, source.length)];
      }
      const offset = run.length - source.length;
      if (this.isSuffix(source, run, offset)) {
        return [
          ...breaksOf(domain, mapping, run, 1, offset + 1),
          ...breaks.map(cut => ({ before: cut.before + offset, at: cut.at })),
        ];
      }
    }
    return breaksOf(domain, mapping, run);
  }

  /** The known run's elements are the first of the run: its ends stand where they stood. */
  private isPrefix(known: TRun<TX>, run: TRun<TX>): boolean {
    const { domain } = this;
    return (
      domain.compare(known.x[0], run.x[0]) === 0 &&
      domain.compare(known.x[known.length - 1], run.x[known.length - 1]) === 0
    );
  }

  private isSuffix(known: TRun<TX>, run: TRun<TX>, offset: number): boolean {
    const { domain } = this;
    return (
      domain.compare(known.x[0], run.x[offset]) === 0 &&
      domain.compare(known.x[known.length - 1], run.x[run.length - 1]) === 0
    );
  }
}
