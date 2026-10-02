import { assert } from '@frozik/utils/assert/assert';
import { FpsMeter } from '@frozik/utils/webgpu/fpsMeter';
import { isNil } from 'lodash-es';

import type { ChartModel } from '../chart-model';
import type { IChartFrame } from '../frame/chart-frame';
import type { IChartHost } from '../host/chart-host';
import type { IFrameScheduler } from '../host/frame-scheduler';
import type { IPaintContribution, IRenderBackend, ISurface } from './backend';

/** A frame a hair early is still on time: a 60 fps tick can arrive at 16.5 ms. */
const THROTTLE_TOLERANCE_MS = 2;

type TBackendSource = IRenderBackend | Promise<IRenderBackend>;

export interface IStageOptions {
  /** The stack a chart is drawn with, bottom first; as a promise when the stack itself depends on what the device can do (§6.2). */
  readonly backends: readonly TBackendSource[] | Promise<readonly TBackendSource[]>;
  readonly scheduler: IFrameScheduler;
}

export interface IChartMounting {
  readonly host: IChartHost;
  /** One canvas per backend the chart draws with, by backend id. */
  readonly canvases: Readonly<Record<string, unknown>>;
}

/** What the stage needs of a chart, whatever its X axis. */
interface IStagedChart {
  readonly frames: { readonly intervalMs: number };
  readonly paintContributions: readonly IPaintContribution[];
  prepareFrame(now: number): IChartFrame<unknown> | undefined;
  detach(): void;
}

interface IMountedChart {
  readonly chart: IStagedChart;
  readonly mounting: IChartMounting;
  surfaces: ReadonlyMap<IRenderBackend, ISurface>;
}

/** Backends take time to come up (a GPU device is requested); the stage exists once they all have. */
export async function createStage(options: IStageOptions): Promise<Stage> {
  return new Stage(await Promise.all(await options.backends), options.scheduler);
}

/**
 * A group of charts on one frame loop: every chart of every backend is drawn
 * in the same frame (§6.1). When a backend can no longer draw — a lost GPU
 * device — the stage goes on with the backends that are left, if every chart
 * on it can be drawn by them.
 */
export class Stage {
  private readonly mounted = new Set<IMountedChart>();
  private readonly fpsMeter = new FpsMeter({
    onUpdate: fps => {
      this.measuredFps = fps;
    },
  });
  private measuredFps = 0;
  private frameHandle: number | undefined;
  private lastFrameAt = 0;
  private destroyed = false;
  private backends: readonly IRenderBackend[];
  private reportLoss: (reason: string) => void = () => {};

  /** Settles with the reason once the stage can no longer draw its charts; never, while it can. */
  readonly lost = new Promise<string>(resolve => {
    this.reportLoss = resolve;
  });

  constructor(
    backends: readonly IRenderBackend[],
    private readonly scheduler: IFrameScheduler
  ) {
    this.backends = backends;
    for (const backend of backends) {
      void backend.lost?.then(reason => this.onBackendLost(backend, reason));
    }
  }

  /** The backends of the stack, bottom first. */
  get backendIds(): readonly string[] {
    return this.backends.map(backend => backend.id);
  }

  /** Frames really drawn a second, across the stage. */
  get fps(): number {
    return this.measuredFps;
  }

  supports(backendId: string): boolean {
    return this.backends.some(backend => backend.id === backendId);
  }

  mount<TX>(chart: ChartModel<TX>, mounting: IChartMounting): VoidFunction {
    assert(!this.destroyed, 'the stage is destroyed');
    const surfaces = this.surfacesFor(chart, mounting, this.backends);
    chart.attach(mounting.host);
    const entry: IMountedChart = { chart, mounting, surfaces };
    this.mounted.add(entry);
    this.start();

    return () => {
      if (!this.mounted.delete(entry)) {
        return;
      }
      chart.detach();
      for (const surface of entry.surfaces.values()) {
        surface.dispose();
      }
      if (this.mounted.size === 0) {
        this.stop();
      }
    };
  }

  /** The backends of `backends` the chart has a canvas for, bottom first. */
  private stackOf(
    mounting: IChartMounting,
    backends: readonly IRenderBackend[]
  ): readonly IRenderBackend[] {
    return backends.filter(backend => !isNil(mounting.canvases[backend.id]));
  }

  /** Whether the backends can draw everything the chart draws. */
  private canDraw(entry: IMountedChart, backends: readonly IRenderBackend[]): boolean {
    const stack = this.stackOf(entry.mounting, backends);
    return (
      stack.length > 0 &&
      entry.chart.paintContributions.every(contribution =>
        entry.chart.paintContributions.some(
          alternative =>
            alternative.id === contribution.id &&
            stack.some(backend => backend.id === alternative.backend)
        )
      )
    );
  }

  private surfacesFor(
    chart: IStagedChart,
    mounting: IChartMounting,
    backends: readonly IRenderBackend[]
  ): ReadonlyMap<IRenderBackend, ISurface> {
    const stack = this.stackOf(mounting, backends);
    assert(stack.length > 0, 'the chart is given a canvas for none of the backends of the stage');
    const contributions = this.resolve(chart.paintContributions, stack);
    return new Map(
      stack.map(backend => [
        backend,
        backend.createSurface(
          mounting.canvases[backend.id],
          contributions.filter(contribution => contribution.backend === backend.id),
          { drawsSeries: backend === stack[0] }
        ),
      ])
    );
  }

  /**
   * A backend is gone. If every chart can be drawn by the ones left, they
   * take over — the next one up draws the series — and nobody is told;
   * otherwise the stage is lost.
   */
  private onBackendLost(lost: IRenderBackend, reason: string): void {
    if (this.destroyed || !this.backends.includes(lost)) {
      return;
    }
    const left = this.backends.filter(backend => backend !== lost);
    if (left.length === 0 || ![...this.mounted].every(entry => this.canDraw(entry, left))) {
      this.reportLoss(reason);
      return;
    }
    this.backends = left;
    for (const entry of this.mounted) {
      for (const surface of entry.surfaces.values()) {
        surface.dispose();
      }
      entry.surfaces = this.surfacesFor(entry.chart, entry.mounting, left);
    }
    lost.dispose();
  }

  /** Of the contributions sharing an id, the one drawn by the lowest backend of the stack that has one. */
  private resolve(
    contributions: readonly IPaintContribution[],
    stack: readonly IRenderBackend[]
  ): readonly IPaintContribution[] {
    const ids = [...new Set(contributions.map(contribution => contribution.id))];
    return ids.map(id => {
      const alternatives = contributions.filter(contribution => contribution.id === id);
      for (const backend of stack) {
        const drawn = alternatives.find(contribution => contribution.backend === backend.id);
        if (!isNil(drawn)) {
          return drawn;
        }
      }
      const wanted = alternatives.map(contribution => `"${contribution.backend}"`).join(' or ');
      throw new Error(`"${id}" draws on the ${wanted} backend, which the chart is not mounted on`);
    });
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.stop();
    for (const entry of this.mounted) {
      entry.chart.detach();
      for (const surface of entry.surfaces.values()) {
        surface.dispose();
      }
    }
    this.mounted.clear();
    for (const backend of this.backends) {
      backend.dispose();
    }
  }

  private start(): void {
    if (isNil(this.frameHandle)) {
      this.frameHandle = this.scheduler.request(this.onFrame);
    }
  }

  private stop(): void {
    if (!isNil(this.frameHandle)) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = undefined;
    }
  }

  private readonly onFrame = (now: number): void => {
    this.frameHandle = this.scheduler.request(this.onFrame);
    const interval = this.frameIntervalMs();
    if (now - this.lastFrameAt < interval - THROTTLE_TOLERANCE_MS) {
      return;
    }
    this.lastFrameAt = now;
    this.fpsMeter.tick(now, interval);
    this.paint(now);
  };

  /** The loop runs at the fastest rate any chart asks for. */
  private frameIntervalMs(): number {
    let interval = Number.POSITIVE_INFINITY;
    for (const { chart } of this.mounted) {
      interval = Math.min(interval, chart.frames.intervalMs);
    }
    return interval;
  }

  private paint(now: number): void {
    const frames = new Map<IMountedChart, IChartFrame<unknown>>();
    for (const entry of this.mounted) {
      const frame = entry.chart.prepareFrame(now);
      if (!isNil(frame)) {
        frames.set(entry, frame);
      }
    }
    for (const backend of this.backends) {
      backend.beginFrame();
      for (const [entry, frame] of frames) {
        entry.surfaces.get(backend)?.paint(frame, now);
      }
      backend.endFrame();
    }
  }
}
