import { isNil } from 'lodash-es';

import type { TAggregateTime, TRun } from '../../core/series/point-run';
import type {
  IDataFailure,
  IDataListener,
  IDataNeed,
  ISeriesData,
} from '../../core/series/series-data';
import type { IAxisRange } from '../../core/viewport/axis-domain';
import type { BreakMarking } from '../cuts/break-marking';
import { chooseScale } from '../scale-choice';
import type { IPersistentCache } from './cache/persistent-cache';
import { Channel } from './channel';
import type { IRetryPolicy } from './failure-log';
import type { IInterval } from './interval';
import { TIME_MAX, TIME_MIN } from './interval';
import type { ITimeseriesSource } from './source';
import type { TTimeScale } from './time-scale';

const MIN_SOFT_LIMIT = 256;
/** A request brings this many times what the plot can show: the next pan or zoom finds it already there. */
const SOFT_LIMIT_RESERVE = 2;
/** What is kept round the wanted range when memory runs short, in its lengths. */
const TRIM_MARGIN = 1;

export interface ITimeseriesSettings {
  readonly source: ITimeseriesSource;
  readonly scales: readonly TTimeScale[];
  readonly prefetch: number;
  readonly maxConcurrent: number;
  readonly retry: IRetryPolicy | undefined;
  readonly maxElements: number;
  readonly now: () => number;
  readonly persistent: { readonly cache: IPersistentCache; readonly key: string } | undefined;
  readonly aggregateTime: TAggregateTime;
  /** The cuts of the axis, for the break markers in the runs; none, and runs go out as they are. */
  readonly breaks: BreakMarking<bigint>;
}

interface IActiveChannel {
  readonly channel: Channel;
  readonly wanted: IInterval;
}

function intervalOf(range: IAxisRange<bigint>): IInterval {
  return range;
}

function widened(interval: IInterval, share: number): IInterval {
  const margin = BigInt(Math.round(Number(interval.end - interval.start) * share));
  const start = interval.start - margin;
  const end = interval.end + margin;
  return { start: start < TIME_MIN ? TIME_MIN : start, end: end > TIME_MAX ? TIME_MAX : end };
}

/**
 * A series of time as a chart sees it: a channel per shape and scale in use,
 * each remembering what it has read. Zooming to another scale opens another
 * channel; what the others know stays until memory runs short (§4.4, §4.7).
 */
export class TimeseriesData implements ISeriesData<bigint> {
  private readonly channels = new Map<string, Channel>();
  private readonly listeners = new Set<IDataListener<bigint>>();
  /** Least recently shown first. */
  private readonly lastShown = new Map<Channel, number>();
  private active: readonly IActiveChannel[] = [];
  private isActive = false;
  private frame = 0;
  private runIds = 0;
  private readonly steps: readonly number[];

  constructor(private readonly settings: ITimeseriesSettings) {
    this.steps = settings.scales.map(Number);
  }

  get extent(): Partial<IAxisRange<bigint>> {
    let start: bigint | undefined;
    let end: bigint | undefined;
    for (const { channel } of this.active) {
      const extent = channel.extent;
      if (!isNil(extent.start) && (isNil(start) || extent.start < start)) {
        start = extent.start;
      }
      if (!isNil(extent.end) && (isNil(end) || extent.end > end)) {
        end = extent.end;
      }
    }
    return { start, end };
  }

  get loading(): readonly IAxisRange<bigint>[] {
    return this.active.flatMap(({ channel, wanted }) => channel.loadingIn(wanted));
  }

  get failed(): readonly IDataFailure<bigint>[] {
    return this.active.flatMap(({ channel, wanted }) =>
      channel.failedIn(wanted).map(failure => ({ range: failure.interval, error: failure.error }))
    );
  }

  activate(): void {
    this.isActive = true;
  }

  suspend(): void {
    this.isActive = false;
    for (const { channel } of this.active) {
      channel.close();
    }
    this.active = [];
  }

  prepare(needs: readonly IDataNeed<bigint>[]): void {
    if (!this.isActive) {
      return;
    }
    this.frame += 1;
    const shown = new Map<Channel, IActiveChannel>();
    for (const need of needs) {
      const channel = this.channelFor(need);
      if (!isNil(channel) && !shown.has(channel)) {
        shown.set(channel, {
          channel,
          wanted: widened(intervalOf(need.range), this.settings.prefetch),
        });
        this.lastShown.set(channel, this.frame);
      }
    }
    for (const { channel } of this.active) {
      if (!shown.has(channel)) {
        channel.close();
      }
    }
    this.active = [...shown.values()];
    for (const need of needs) {
      const channel = this.channelFor(need);
      const entry = isNil(channel) ? undefined : shown.get(channel);
      if (!isNil(entry)) {
        entry.channel.open();
        entry.channel.fill(entry.wanted, this.softLimitOf(need));
      }
    }
    this.freeMemory();
  }

  runs(need: IDataNeed<bigint>): readonly TRun<bigint>[] {
    return this.settings.breaks.of(this.channelFor(need)?.runsIn(intervalOf(need.range)) ?? []);
  }

  retry(range: IAxisRange<bigint>): void {
    for (const { channel } of this.active) {
      channel.retry(intervalOf(range));
    }
  }

  subscribe(listener: IDataListener<bigint>): VoidFunction {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.suspend();
    this.channels.clear();
    this.lastShown.clear();
    this.listeners.clear();
  }

  /** The channel a need is served from; none while the chart has no width to choose a scale by. */
  private channelFor(need: IDataNeed<bigint>): Channel | undefined {
    const span = Number(need.range.end - need.range.start);
    if (need.widthPx <= 0 || span <= 0) {
      return undefined;
    }
    const { scales, source, maxConcurrent, retry, now, persistent, aggregateTime } = this.settings;
    const scale = scales[chooseScale(this.steps, span / need.widthPx, need.pixelsPerElement)];
    const key = `${need.shape}:${scale}`;
    let channel = this.channels.get(key);
    if (isNil(channel)) {
      channel = new Channel({
        source,
        shape: need.shape,
        scale,
        nextId: () => {
          this.runIds += 1;
          return this.runIds;
        },
        maxConcurrent,
        retry,
        now,
        persistent,
        aggregateTime,
        onChanged: range => this.listeners.forEach(listener => listener.changed(range)),
        onFailed: ({ interval, error }) =>
          this.listeners.forEach(listener => listener.failed({ range: interval, error })),
      });
      this.channels.set(key, channel);
    }
    return channel;
  }

  private softLimitOf(need: IDataNeed<bigint>): number {
    const visible = need.widthPx / need.pixelsPerElement;
    return Math.max(
      MIN_SOFT_LIMIT,
      Math.ceil(visible * (1 + 2 * this.settings.prefetch) * SOFT_LIMIT_RESERVE)
    );
  }

  /**
   * Over the budget, first what is not shown goes, least recently shown
   * first, then what lies far from the wanted range. What is on screen is
   * never dropped, whatever the budget (§4.7).
   */
  private freeMemory(): void {
    const { maxElements } = this.settings;
    let total = 0;
    for (const channel of this.channels.values()) {
      total += channel.store.elementCount;
    }
    if (total <= maxElements) {
      return;
    }
    const shown = new Set(this.active.map(({ channel }) => channel));
    const idle = [...this.channels.values()]
      .filter(channel => !shown.has(channel))
      .sort(
        (first, second) => (this.lastShown.get(first) ?? 0) - (this.lastShown.get(second) ?? 0)
      );
    for (const channel of idle) {
      if (total <= maxElements) {
        return;
      }
      total -= channel.store.elementCount;
      channel.forget(undefined);
    }
    for (const { channel, wanted } of this.active) {
      channel.forget(widened(wanted, TRIM_MARGIN));
    }
  }
}
