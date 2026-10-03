import { assert } from '@frozik/utils/assert/assert';
import { EventBus } from '@frozik/utils/events/event-bus';
import { isNil } from 'lodash-es';

import type { IChartOptions, TAnyExtension } from './chart-options';
import type { IChartFrame, ISeriesFrame } from './frame/chart-frame';
import { darkTheme } from './frame/dark-theme';
import { ACTIVE_FPS, FrameDemand } from './frame/frame-demand';
import type { IChartTheme } from './frame/theme';
import { addInsets } from './frame/theme';
import type { IChartHost } from './host/chart-host';
import type { IChartSize } from './host/size-source';
import { isSameSize } from './host/size-source';
import type { IChartEvents } from './kernel/events';
import { ExtensionRegistry } from './kernel/extension-registry';
import type { IChartKernel } from './kernel/kernel';
import { SeriesModel } from './kernel/series-model';
import { percentBaseOf } from './scale/percent-base';
import { ScaleSet } from './scale/scale-set';
import type { IDataFailure } from './series/series-data';
import type { IPaintContribution } from './stage/backend';
import type { IAxisDomain, IAxisRange } from './viewport/axis-domain';
import { spanOf, withinMaxSpan } from './viewport/axis-domain';
import { plotRectOf } from './viewport/plot-geometry';
import { Viewport } from './viewport/viewport';

const IDLE_FPS = 10;
const CSS_PIXEL_RATIO = 1;

/**
 * A chart without pixels: the viewport, the series, the extensions, and the
 * pipeline that turns them into one immutable frame a backend can draw (§3.6).
 */
export class ChartModel<TX> implements IChartKernel<TX> {
  readonly id: string | undefined;
  readonly domain: IAxisDomain<TX>;
  readonly viewport: Viewport<TX>;
  readonly scales: ScaleSet;
  readonly series: SeriesModel<TX>;
  readonly events = new EventBus<IChartEvents<TX>>();
  readonly frames = new FrameDemand(IDLE_FPS);

  private readonly registry = new ExtensionRegistry<TX>();
  private currentTheme: IChartTheme;
  private host: IChartHost | undefined;
  private unmountExtensions: VoidFunction | undefined;
  private measured: IChartSize | undefined;
  private built: IChartFrame<TX> | undefined;
  private builtKey = '';
  private dataChanges = 0;

  constructor(options: IChartOptions<TX, readonly TAnyExtension<TX>[]>) {
    this.id = options.id;
    this.domain = options.x.domain;
    this.currentTheme = options.theme ?? darkTheme;
    this.viewport = new Viewport({
      domain: this.domain,
      x: { start: options.x.start, end: options.x.end },
      constrain: range => withinMaxSpan(this.domain, this.registry.constrainX(range)),
      onChange: () => {
        this.frames.raise(ACTIVE_FPS);
        this.events.emit('viewport.changed', undefined);
      },
    });
    this.scales = new ScaleSet({ panes: options.panes, scales: options.scales, range: options.y });
    this.series = new SeriesModel(
      options.series,
      this.domain,
      {
        dataChanged: (seriesIds, range) => {
          this.touchData();
          this.events.emit('data.changed', { seriesIds, range });
        },
        dataFailed: (seriesIds, failure) => {
          this.touchData();
          this.events.emit('data.failed', { seriesIds, failure });
        },
        styleChanged: seriesId => {
          this.touchData();
          this.events.emit('style.changed', { seriesId });
        },
      },
      this.scales.defaultId
    );
    for (const { scale, id } of options.series) {
      assert(
        isNil(scale) || this.scales.ids.includes(scale),
        `series "${id}" names the value scale "${scale}", which the chart does not have`
      );
    }
    for (const extension of options.extensions) {
      this.registry.register(extension, this);
    }
  }

  get theme(): IChartTheme {
    return this.currentTheme;
  }

  get size(): IChartSize | undefined {
    return this.measured;
  }

  get frame(): IChartFrame<TX> | undefined {
    return this.built;
  }

  get dataExtent(): Partial<IAxisRange<TX>> {
    return this.series.extent;
  }

  get paintContributions(): readonly IPaintContribution[] {
    return this.registry.paint;
  }

  get isMounted(): boolean {
    return !isNil(this.host);
  }

  extension<TSlice>(id: string): TSlice | undefined {
    return this.registry.slice<TSlice>(id);
  }

  on<TName extends keyof IChartEvents<TX>>(
    event: TName,
    handler: (payload: IChartEvents<TX>[TName]) => void
  ): VoidFunction {
    return this.events.on(event, handler);
  }

  setTheme(theme: IChartTheme): void {
    this.currentTheme = theme;
    this.series.restyle();
    this.touchData();
  }

  /** The chart is on a stage: extensions get the host, the data starts asking and listening (§3.9). */
  attach(host: IChartHost): void {
    this.host = host;
    this.unmountExtensions = this.registry.mount(host);
    this.series.activate();
    this.frames.raise(ACTIVE_FPS);
  }

  /** Off the stage: subscriptions closed, requests in flight cancelled, everything cached kept. */
  detach(): void {
    this.series.suspend();
    this.unmountExtensions?.();
    this.unmountExtensions = undefined;
    this.host = undefined;
    this.measured = undefined;
  }

  /** One pass of the pipeline; nothing while the chart is not mounted, has no size, or has nothing to show. */
  prepareFrame(now: number): IChartFrame<TX> | undefined {
    if (isNil(this.host)) {
      return undefined;
    }
    this.built = this.buildFrame(this.host, now);
    this.events.emit('frame.prepared', undefined);
    return this.built;
  }

  private buildFrame(host: IChartHost, now: number): IChartFrame<TX> | undefined {
    this.frames.tick(now);
    const size = this.measure(host);
    if (size.width === 0 || size.height === 0) {
      return undefined;
    }
    this.registry.tick(now);
    this.viewport.setCurrent(this.registry.animate(this.viewport.current, this.viewport.target));

    const visible = {
      range: this.viewport.current,
      widthPx: size.width / Math.max(CSS_PIXEL_RATIO, size.devicePixelRatio),
    };
    this.series.prepare(visible);
    const series = this.series.frames(visible, this.currentTheme);
    const loading = this.series.loading;
    const failed = this.series.failed;
    const hasData = series.some(each => each.runs.some(styled => styled.run.length > 0));
    if (!hasData && loading.length === 0 && failed.length === 0) {
      return undefined;
    }

    for (const scaleId of this.scales.ids) {
      if (this.scales.isHeld(scaleId)) {
        continue;
      }
      const fitted = this.registry.fitY({
        domain: this.domain,
        x: this.viewport.current,
        scaleKind: this.scales.kindOf(scaleId),
        padding: this.scales.paddingOf(scaleId),
        series: series.filter(each => each.scaleId === scaleId),
      });
      if (!isNil(fitted)) {
        this.scales.setRange(scaleId, fitted);
      }
    }
    return this.frameOf(size, series, loading, failed);
  }

  dispose(): void {
    this.detach();
    this.registry.dispose();
    this.series.dispose();
    this.events.clear();
  }

  private measure(host: IChartHost): IChartSize {
    const size = host.size.measure();
    if (isNil(this.measured) || !isSameSize(this.measured, size)) {
      const previous = this.measured;
      this.measured = size;
      this.events.emit('size.changed', { previous, next: size });
    }
    return size;
  }

  private touchData(): void {
    this.dataChanges += 1;
    this.frames.raise(ACTIVE_FPS);
  }

  /** The same frame object for as long as nothing it is made of changed (§3.6). */
  private frameOf(
    size: IChartSize,
    series: readonly ISeriesFrame<TX>[],
    loading: readonly IAxisRange<TX>[],
    failed: readonly IDataFailure<TX>[]
  ): IChartFrame<TX> {
    const insets = addInsets(this.currentTheme.margin, this.registry.insets());
    const runsKey = series
      .map(each => each.runs.map(styled => `${styled.run.id}.${styled.run.revision}`).join(','))
      .join(';');
    const key = [
      this.viewport.revision,
      this.scales.revision,
      size.width,
      size.height,
      size.devicePixelRatio,
      this.dataChanges,
      runsKey,
      loading.length,
      failed.length,
      insets.left,
      insets.top,
      insets.right,
      insets.bottom,
    ].join('|');
    if (!isNil(this.built) && key === this.builtKey && loading.length === 0) {
      return this.built;
    }
    this.builtKey = key;
    const plot = plotRectOf(size, insets);
    const x = this.viewport.current;
    return {
      domain: this.domain,
      x,
      xSpan: spanOf(this.domain, x),
      size,
      plot,
      panes: this.scales.layout(size, plot, scaleId =>
        percentBaseOf(
          this.domain,
          x.start,
          series.filter(each => each.scaleId === scaleId)
        )
      ),
      series,
      loading,
      failed,
      theme: this.currentTheme,
    };
  }
}
