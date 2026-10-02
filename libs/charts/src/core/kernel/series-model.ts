import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { ISeriesFrame } from '../frame/chart-frame';
import type { IChartTheme } from '../frame/theme';
import type { TRun } from '../series/point-run';
import type { ISeries } from '../series/series';
import type {
  IDataFailure,
  IDataNeed,
  ISeriesData,
  ISeriesDataFactory,
} from '../series/series-data';
import type { IStyledRun, IStyleProcessor } from '../series/style-processor';
import type { IAxisDomain, IAxisRange } from '../viewport/axis-domain';
import { maxOf, minOf } from '../viewport/axis-domain';

interface ISeriesEntry<TX> {
  readonly id: string;
  readonly data: ISeriesData<TX>;
  style: IStyleProcessor<TX>;
  styleRevision: number;
  /** Styled runs by run id: a run is styled again only when its revision or the style changed (§5.2). */
  readonly styled: Map<number, IStyledRun<TX>>;
}

export interface ISeriesHooks<TX> {
  dataChanged(seriesIds: readonly string[], range: IAxisRange<TX>): void;
  dataFailed(seriesIds: readonly string[], failure: IDataFailure<TX>): void;
  styleChanged(seriesId: string): void;
}

export interface IVisibleSpan<TX> {
  readonly range: IAxisRange<TX>;
  /** CSS pixels the range is spread over. */
  readonly widthPx: number;
}

/** The series of a chart: their data instances — one per distinct description — and their styles. */
export class SeriesModel<TX> {
  private readonly entries: ISeriesEntry<TX>[];
  private readonly instances = new Map<ISeriesDataFactory<TX>, ISeriesData<TX>>();
  private readonly unsubscribes: VoidFunction[] = [];

  constructor(
    definitions: readonly ISeries<TX>[],
    private readonly domain: IAxisDomain<TX>,
    private readonly hooks: ISeriesHooks<TX>
  ) {
    this.entries = definitions.map(definition => ({
      id: definition.id,
      data: this.instanceOf(definition.data),
      style: definition.style,
      styleRevision: 0,
      styled: new Map(),
    }));
    assert(
      new Set(this.entries.map(entry => entry.id)).size === this.entries.length,
      'series ids are unique within a chart'
    );
    for (const data of this.instances.values()) {
      const seriesIds = this.entries.filter(entry => entry.data === data).map(entry => entry.id);
      this.unsubscribes.push(
        data.subscribe({
          changed: range => this.hooks.dataChanged(seriesIds, range),
          failed: failure => this.hooks.dataFailed(seriesIds, failure),
        })
      );
    }
  }

  get ids(): readonly string[] {
    return this.entries.map(entry => entry.id);
  }

  /** The chart's density: the widest element with its gap among the series (§4.3). */
  get pixelsPerElement(): number {
    return Math.max(
      1,
      ...this.entries.map(entry => entry.style.elementWidth + entry.style.elementGap)
    );
  }

  get loading(): readonly IAxisRange<TX>[] {
    return [...this.instances.values()].flatMap(data => data.loading);
  }

  get failed(): readonly IDataFailure<TX>[] {
    return [...this.instances.values()].flatMap(data => data.failed);
  }

  get extent(): Partial<IAxisRange<TX>> {
    let start: TX | undefined;
    let end: TX | undefined;
    for (const data of this.instances.values()) {
      const { extent } = data;
      if (!isNil(extent.start)) {
        start = isNil(start) ? extent.start : minOf(this.domain, start, extent.start);
      }
      if (!isNil(extent.end)) {
        end = isNil(end) ? extent.end : maxOf(this.domain, end, extent.end);
      }
    }
    return { start, end };
  }

  styleOf(id: string): IStyleProcessor<TX> {
    return this.entryOf(id).style;
  }

  /** Another look for a series on a live chart; data is asked for again only if the shape changed (§5.2). */
  setStyle(id: string, style: IStyleProcessor<TX>): void {
    const entry = this.entryOf(id);
    entry.style = style;
    entry.styleRevision += 1;
    entry.styled.clear();
    this.hooks.styleChanged(id);
  }

  /** Whatever the styles read besides the data changed — the theme: every run is styled anew. */
  restyle(): void {
    for (const entry of this.entries) {
      entry.styleRevision += 1;
      entry.styled.clear();
    }
  }

  retry(range: IAxisRange<TX>): void {
    for (const data of this.instances.values()) {
      data.retry(range);
    }
  }

  activate(): void {
    for (const data of this.instances.values()) {
      data.activate();
    }
  }

  suspend(): void {
    for (const data of this.instances.values()) {
      data.suspend();
    }
  }

  prepare(visible: IVisibleSpan<TX>): void {
    for (const data of this.instances.values()) {
      data.prepare(
        this.entries.filter(entry => entry.data === data).map(entry => this.needOf(entry, visible))
      );
    }
  }

  frames(visible: IVisibleSpan<TX>, theme: IChartTheme): readonly ISeriesFrame<TX>[] {
    return this.entries.map(entry => ({
      id: entry.id,
      runs: this.styledRuns(entry, entry.data.runs(this.needOf(entry, visible)), theme),
    }));
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes.splice(0)) {
      unsubscribe();
    }
    for (const data of this.instances.values()) {
      data.dispose();
    }
    this.instances.clear();
  }

  private instanceOf(factory: ISeriesDataFactory<TX>): ISeriesData<TX> {
    const existing = this.instances.get(factory);
    if (!isNil(existing)) {
      return existing;
    }
    const created = factory.create({ domain: this.domain });
    this.instances.set(factory, created);
    return created;
  }

  private entryOf(id: string): ISeriesEntry<TX> {
    const entry = this.entries.find(candidate => candidate.id === id);
    assert(!isNil(entry), `no series "${id}" on the chart`);
    return entry;
  }

  private needOf(entry: ISeriesEntry<TX>, visible: IVisibleSpan<TX>): IDataNeed<TX> {
    return {
      range: visible.range,
      shape: entry.style.shape,
      pixelsPerElement: this.pixelsPerElement,
      widthPx: visible.widthPx,
    };
  }

  private styledRuns(
    entry: ISeriesEntry<TX>,
    runs: readonly TRun<TX>[],
    theme: IChartTheme
  ): readonly IStyledRun<TX>[] {
    const live = new Set<number>();
    const styledRuns = runs.map(run => {
      live.add(run.id);
      const cached = entry.styled.get(run.id);
      if (!isNil(cached) && cached.run === run) {
        return cached;
      }
      const styled = this.styleRun(entry, run, theme);
      entry.styled.set(run.id, styled);
      return styled;
    });
    for (const runId of entry.styled.keys()) {
      if (!live.has(runId)) {
        entry.styled.delete(runId);
      }
    }
    return styledRuns;
  }

  private styleRun(entry: ISeriesEntry<TX>, run: TRun<TX>, theme: IChartTheme): IStyledRun<TX> {
    assert(
      run.shape === entry.style.shape,
      `series "${entry.id}" asked for ${entry.style.shape} data and got ${run.shape}`
    );
    const style = entry.style.style(run, { theme });
    for (const { mark } of style.marks) {
      assert(
        mark.shapes.includes(run.shape),
        `series "${entry.id}": the "${mark.id}" mark cannot be drawn from ${run.shape} data`
      );
    }
    return { run, style, styleRevision: entry.styleRevision };
  }
}
