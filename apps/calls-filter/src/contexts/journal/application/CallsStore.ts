import { assert } from '@frozik/utils/assert/assert';
import { groupBy } from 'lodash-es';
import { action, computed, makeObservable, observableRef } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import type { TAssignableGroup, TGroup, TGroupId } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import { customGroups } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import { membership } from '../../grouping/domain/membership';
import type { IClock } from '../../policy/domain/ports/clock';
import type { IJournalEntry } from '../domain/journal-entry';
import { mergeJournal } from '../domain/journal-merge';
import type { ICallHistory } from '../domain/ports/call-history';
import type { ICallJournal } from '../domain/ports/call-journal';

/** A caller of the journal on one day, in the group it belongs to now by the current book. */
export interface ICallRow {
  /** The latest call of this caller that day. */
  readonly entry: IJournalEntry;
  readonly group: TGroup;
  /** Other groups that take the caller too: an open conflict. */
  readonly conflictWith: readonly TAssignableGroup[];
  readonly calls: number;
}

export interface ICallDay {
  readonly date: Temporal.PlainDate;
  readonly rows: readonly ICallRow[];
}

const JOURNAL_LIMIT = 5_000;
const FREQUENT_GROUPS = 3;
const HOURS_PER_DAY = 24;
const FREQUENT_DAYS = 30;

function callerKey(entry: IJournalEntry): string {
  return entry.caller.number ?? `name:${entry.caller.networkName ?? 'hidden'}`;
}

/** The journal as the screens read it: callers by day, each in its current group. */
export class CallsStore {
  entries: readonly IJournalEntry[] = [];
  private reads = 0;

  constructor(
    private readonly journal: ICallJournal,
    private readonly history: ICallHistory,
    private readonly clock: IClock,
    private readonly days: () => number,
    private readonly book: () => GroupBook,
    private readonly environment: () => IMatchingEnvironment
  ) {
    makeObservable<CallsStore, 'setEntries'>(this, {
      entries: observableRef,
      byDay: computed,
      frequentTargets: computed,
      setEntries: action,
    });
  }

  /** Reads both logs off the main thread; of overlapping reads, only the latest lands. */
  async refresh(): Promise<void> {
    this.reads += 1;
    const read = this.reads;
    const from = this.clock.now().subtract({ hours: this.days() * HOURS_PER_DAY });
    const [screened, history] = await Promise.all([
      this.journal.since(from, JOURNAL_LIMIT),
      this.history.since(from, JOURNAL_LIMIT),
    ]);
    if (read === this.reads) {
      this.setEntries(mergeJournal(screened, history));
    }
  }

  private setEntries(entries: readonly IJournalEntry[]): void {
    this.entries = entries;
  }

  /** Re-reads the journal whenever the service writes; returns the unsubscribe. */
  follow(): () => void {
    return this.journal.onChange(() => void this.refresh());
  }

  get byDay(): readonly ICallDay[] {
    return this.callDays(() => true);
  }

  daysOf(group: TGroupId): readonly ICallDay[] {
    return this.callDays(
      row => row.group.id === group || row.conflictWith.some(other => other.id === group)
    );
  }

  countToday(group: TGroupId): number {
    const today = this.clock.localNow().toPlainDate();
    return this.daysOf(group)
      .filter(day => day.date.equals(today))
      .reduce((total, day) => total + day.rows.reduce((sum, row) => sum + row.calls, 0), 0);
  }

  /** Where moves went lately: the groups that got members in the last month, most first. */
  get frequentTargets(): readonly TGroupId[] {
    const since = this.clock
      .now()
      .subtract({ hours: FREQUENT_DAYS * HOURS_PER_DAY }).epochMilliseconds;
    return customGroups(this.book())
      .map(group => ({
        id: group.id,
        recent: group.include.filter(member => member.updatedAt.epochMilliseconds >= since).length,
      }))
      .sort((left, right) => right.recent - left.recent)
      .slice(0, FREQUENT_GROUPS)
      .map(group => group.id);
  }

  private rowOf(entry: IJournalEntry, calls: number): ICallRow {
    const found = membership(this.book(), entry.caller, this.environment());
    if (found.kind === 'one') {
      return { entry, group: found.group, conflictWith: [], calls };
    }
    const [first, ...others] = found.groups;
    assert(first !== undefined, 'a conflict has groups');
    return { entry, group: first, conflictWith: others, calls };
  }

  private callDays(keep: (row: ICallRow) => boolean): readonly ICallDay[] {
    const zone = this.clock.timeZone();
    const byDate = groupBy(this.entries, entry =>
      entry.at.toZonedDateTimeISO(zone).toPlainDate().toString()
    );
    return Object.entries(byDate)
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, entries]) => ({
        date: Temporal.PlainDate.from(date),
        rows: Object.values(groupBy(entries, callerKey))
          .flatMap(callerEntries => {
            const latest = [...callerEntries].sort(
              (left, right) => right.at.epochMilliseconds - left.at.epochMilliseconds
            )[0];
            return latest === undefined ? [] : [this.rowOf(latest, callerEntries.length)];
          })
          .filter(keep)
          .sort(
            (left, right) => right.entry.at.epochMilliseconds - left.entry.at.epochMilliseconds
          ),
      }))
      .filter(day => day.rows.length > 0);
  }
}
