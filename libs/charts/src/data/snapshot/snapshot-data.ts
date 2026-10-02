import { isNil } from 'lodash-es';

import { columnsOf } from '../../core/series/columns';
import { ChartDataError, toDataError } from '../../core/series/data-error';
import type { TRun } from '../../core/series/point-run';
import { runOf } from '../../core/series/point-run';
import type {
  IDataFailure,
  IDataListener,
  IDataNeed,
  ISeriesData,
} from '../../core/series/series-data';
import type { TShape } from '../../core/series/shape';
import type { IAxisDomain, IAxisRange } from '../../core/viewport/axis-domain';
import { spanOf } from '../../core/viewport/axis-domain';
import { chooseScale } from '../scale-choice';
import type { ISnapshotSource, ISnapshotWindow } from './source';

/** The window is asked this many lengths of the view wider on each side, so a small pan asks for nothing. */
const WINDOW_MARGIN = 1;
/** Without named scales, a window is read again once the density it was read for is this many times off. */
const DENSITY_TOLERANCE = 2;

export interface ISnapshotSettings<TX> {
  readonly source: ISnapshotSource<TX>;
  readonly domain: IAxisDomain<TX>;
  /** Ascending. */
  readonly scales: readonly number[] | undefined;
}

/** What a window was read for: another scale or density needs another window. */
interface IGrain {
  readonly scale: number | undefined;
  readonly unitsPerElement: number;
}

interface IWindow<TX> {
  readonly run: TRun<TX> | undefined;
  readonly range: IAxisRange<TX> | undefined;
  readonly grain: IGrain;
}

interface IRequest<TX> {
  readonly controller: AbortController;
  readonly view: IAxisRange<TX>;
  readonly grain: IGrain;
}

interface IShapeState<TX> {
  window: IWindow<TX> | undefined;
  request: IRequest<TX> | undefined;
  /** The source said the window is out of date. */
  stale: boolean;
  failure: IDataFailure<TX> | undefined;
  view: IAxisRange<TX> | undefined;
}

/** One window per shape — the last answer — replaced whole; the old one is drawn until the new arrives (§4.5). */
export class SnapshotData<TX> implements ISeriesData<TX> {
  readonly extent = {};
  private readonly states = new Map<TShape, IShapeState<TX>>();
  private readonly listeners = new Set<IDataListener<TX>>();
  private unsubscribe: VoidFunction | undefined;
  private runIds = 0;

  constructor(private readonly settings: ISnapshotSettings<TX>) {}

  get loading(): readonly IAxisRange<TX>[] {
    return [...this.states.values()].flatMap(state =>
      isNil(state.request) || isNil(state.view) ? [] : this.missingOf(state.view, state.window)
    );
  }

  get failed(): readonly IDataFailure<TX>[] {
    return [...this.states.values()].flatMap(state => state.failure ?? []);
  }

  activate(): void {
    this.unsubscribe ??= this.settings.source.subscribe(range => this.onChange(range));
  }

  suspend(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const state of this.states.values()) {
      state.request?.controller.abort();
      state.request = undefined;
    }
  }

  prepare(needs: readonly IDataNeed<TX>[]): void {
    if (isNil(this.unsubscribe)) {
      return;
    }
    const seen = new Set<TShape>();
    for (const need of needs) {
      if (need.widthPx > 0 && !seen.has(need.shape)) {
        seen.add(need.shape);
        this.prepareShape(need);
      }
    }
  }

  runs(need: IDataNeed<TX>): readonly TRun<TX>[] {
    const run = this.states.get(need.shape)?.window?.run;
    return isNil(run) ? [] : [run];
  }

  retry(): void {
    for (const state of this.states.values()) {
      state.failure = undefined;
    }
  }

  subscribe(listener: IDataListener<TX>): VoidFunction {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.suspend();
    this.states.clear();
    this.listeners.clear();
  }

  private prepareShape(need: IDataNeed<TX>): void {
    const state = this.stateOf(need.shape);
    const grain = this.grainOf(need);
    state.view = need.range;
    if (!isNil(state.failure)) {
      if (this.overlaps(state.failure.range, need.range)) {
        return;
      }
      state.failure = undefined;
    }
    const { window, request } = state;
    if (!state.stale && !isNil(window) && this.windowServes(window, need.range, grain)) {
      return;
    }
    if (
      !isNil(request) &&
      this.contains(request.view, need.range) &&
      this.isSameGrain(request.grain, grain)
    ) {
      return;
    }
    this.request(state, need, grain);
  }

  private request(state: IShapeState<TX>, need: IDataNeed<TX>, grain: IGrain): void {
    const { source, domain } = this.settings;
    state.request?.controller.abort();
    const margin = spanOf(domain, need.range) * WINDOW_MARGIN;
    const asked: IAxisRange<TX> = {
      start: domain.add(need.range.start, -margin),
      end: domain.add(need.range.end, margin),
    };
    const request: IRequest<TX> = { controller: new AbortController(), view: asked, grain };
    state.request = request;
    state.stale = false;
    source
      .fetch({
        from: asked.start,
        to: asked.end,
        scale: grain.scale,
        shape: need.shape,
        maxElements: Math.ceil((need.widthPx * (1 + 2 * WINDOW_MARGIN)) / need.pixelsPerElement),
        signal: request.controller.signal,
      })
      .then(
        answer => {
          if (state.request === request) {
            state.request = undefined;
            this.onAnswer(state, need.shape, answer, grain, asked);
          }
        },
        (error: unknown) => {
          if (state.request === request) {
            state.request = undefined;
            this.fail(state, asked, toDataError(error));
          }
        }
      );
  }

  private onAnswer(
    state: IShapeState<TX>,
    shape: TShape,
    answer: ISnapshotWindow<TX>,
    grain: IGrain,
    asked: IAxisRange<TX>
  ): void {
    if (answer.data.shape !== shape) {
      this.fail(
        state,
        asked,
        new ChartDataError('INTERNAL', `the source answered with ${answer.data.shape}s`)
      );
      return;
    }
    const columns = columnsOf(answer.data);
    this.runIds += 1;
    state.window = {
      run:
        columns.length === 0
          ? undefined
          : runOf<TX>(columns, { id: this.runIds, revision: 0, step: grain.scale }),
      range: answer.range,
      grain,
    };
    this.listeners.forEach(listener => listener.changed(answer.range ?? asked));
  }

  private fail(state: IShapeState<TX>, range: IAxisRange<TX>, error: ChartDataError): void {
    if (error.code === 'CANCELLED') {
      return;
    }
    state.failure = { range, error };
    const failure = state.failure;
    this.listeners.forEach(listener => listener.failed(failure));
  }

  private onChange(range: IAxisRange<TX> | undefined): void {
    for (const state of this.states.values()) {
      const held = state.window?.range;
      const touches = isNil(range) || isNil(held) || this.overlaps(range, held);
      if (touches) {
        state.stale = true;
        state.failure = undefined;
      }
    }
    const changed = range ?? this.anyView();
    if (!isNil(changed)) {
      this.listeners.forEach(listener => listener.changed(changed));
    }
  }

  private anyView(): IAxisRange<TX> | undefined {
    for (const state of this.states.values()) {
      if (!isNil(state.view)) {
        return state.view;
      }
    }
    return undefined;
  }

  private stateOf(shape: TShape): IShapeState<TX> {
    let state = this.states.get(shape);
    if (isNil(state)) {
      state = {
        window: undefined,
        request: undefined,
        stale: false,
        failure: undefined,
        view: undefined,
      };
      this.states.set(shape, state);
    }
    return state;
  }

  private grainOf(need: IDataNeed<TX>): IGrain {
    const { scales, domain } = this.settings;
    const unitsPerPixel = spanOf(domain, need.range) / need.widthPx;
    return {
      scale: isNil(scales)
        ? undefined
        : scales[chooseScale(scales, unitsPerPixel, need.pixelsPerElement)],
      unitsPerElement: unitsPerPixel * need.pixelsPerElement,
    };
  }

  private isSameGrain(held: IGrain, wanted: IGrain): boolean {
    if (!isNil(this.settings.scales)) {
      return held.scale === wanted.scale;
    }
    const ratio = held.unitsPerElement / wanted.unitsPerElement;
    return ratio <= DENSITY_TOLERANCE && ratio >= 1 / DENSITY_TOLERANCE;
  }

  /** A window without a range holds everything there is — at the scale it was asked at, when scales are named. */
  private windowServes(window: IWindow<TX>, view: IAxisRange<TX>, grain: IGrain): boolean {
    if (isNil(window.range)) {
      return isNil(this.settings.scales) || this.isSameGrain(window.grain, grain);
    }
    return this.contains(window.range, view) && this.isSameGrain(window.grain, grain);
  }

  private overlaps(first: IAxisRange<TX>, second: IAxisRange<TX>): boolean {
    const { domain } = this.settings;
    return (
      domain.compare(first.start, second.end) <= 0 && domain.compare(second.start, first.end) <= 0
    );
  }

  private contains(outer: IAxisRange<TX>, inner: IAxisRange<TX>): boolean {
    const { domain } = this.settings;
    return (
      domain.compare(outer.start, inner.start) <= 0 && domain.compare(outer.end, inner.end) >= 0
    );
  }

  /** The parts of the view the window on screen does not hold: only they are shown as loading. */
  private missingOf(
    view: IAxisRange<TX>,
    window: IWindow<TX> | undefined
  ): readonly IAxisRange<TX>[] {
    if (isNil(window)) {
      return [view];
    }
    const held = window.range;
    // A window without a range holds everything there is.
    if (isNil(held)) {
      return [];
    }
    const { domain } = this.settings;
    if (domain.compare(held.end, view.start) < 0 || domain.compare(held.start, view.end) > 0) {
      return [view];
    }
    const missing: IAxisRange<TX>[] = [];
    if (domain.compare(view.start, held.start) < 0) {
      missing.push({ start: view.start, end: held.start });
    }
    if (domain.compare(view.end, held.end) > 0) {
      missing.push({ start: held.end, end: view.end });
    }
    return missing;
  }
}
