import type { ISnapshotSource } from '@frozik/charts/data/snapshot/source';
import { makeAutoObservable, observableRef } from 'mobx';

import type { CallFailure } from '../domain/call-failure';
import { toCallFailure } from '../domain/call-failure';
import type { PlotInputError, PlotLimits, PlotView } from '../domain/plot';
import { validatePlotView } from '../domain/plot';
import type { IClock } from '../domain/ports/clock';
import type { IPlotClient } from '../domain/ports/plot-client';
import { createPlotSource } from './plot-source';

export type PlotState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'invalid-input'; readonly error: PlotInputError }
  | {
      readonly kind: 'live';
      readonly id: number;
      readonly view: PlotView;
      readonly source: ISnapshotSource<number>;
    }
  | { readonly kind: 'failed'; readonly view: PlotView; readonly failure: CallFailure };

export interface LastSample {
  readonly points: number;
  readonly durationMs: number;
}

export interface PlotModelDependencies {
  readonly client: IPlotClient;
  readonly clock: IClock;
  readonly devicePixelRatio: () => number;
}

const DEFAULT_VIEW: PlotView = { expression: 'x^2 + 2x + 3', xMin: -10, xMax: 10 };

/** Until the server tells its own limits, the page assumes modest ones. */
const FALLBACK_LIMITS: PlotLimits = { expressionMaxLength: 200, sampleMaxPoints: 5000 };

/** The function the visitor typed, and the live chart the server samples for it. */
export class PlotModel {
  view: PlotView = DEFAULT_VIEW;
  limits: PlotLimits = FALLBACK_LIMITS;
  state: PlotState = { kind: 'idle' };
  lastSample: LastSample | undefined;
  private nextId = 1;

  constructor(private readonly dependencies: PlotModelDependencies) {
    makeAutoObservable<PlotModel, 'dependencies' | 'nextId'>(
      this,
      {
        dependencies: false,
        nextId: false,
        state: observableRef,
        view: observableRef,
        limits: observableRef,
        lastSample: observableRef,
      },
      { autoBind: true }
    );
  }

  setView(change: Partial<PlotView>): void {
    this.view = { ...this.view, ...change };
  }

  async loadLimits(signal: AbortSignal): Promise<void> {
    this.setLimits(await this.dependencies.client.limits(signal));
  }

  /** Puts a live chart of the function on screen; the chart fetches its own windows from here on. */
  plot(): void {
    const view = this.view;
    const inputError = validatePlotView(view, this.limits);
    if (inputError !== undefined) {
      this.state = { kind: 'invalid-input', error: inputError };
      return;
    }
    const id = this.nextId++;
    this.lastSample = undefined;
    this.state = {
      kind: 'live',
      id,
      view,
      source: createPlotSource({
        view,
        client: this.dependencies.client,
        maxPoints: this.limits.sampleMaxPoints,
        now: () => this.dependencies.clock.now(),
        devicePixelRatio: this.dependencies.devicePixelRatio,
        onSampled: (points, durationMs) => this.recordSample(id, { points, durationMs }),
        onFailed: error => this.recordFailure(id, view, error),
      }),
    };
  }

  dispose(): void {
    this.state = { kind: 'idle' };
  }

  private setLimits(limits: PlotLimits): void {
    this.limits = limits;
  }

  private isLive(id: number): boolean {
    return this.state.kind === 'live' && this.state.id === id;
  }

  private recordSample(id: number, sample: LastSample): void {
    if (this.isLive(id)) {
      this.lastSample = sample;
    }
  }

  private recordFailure(id: number, view: PlotView, error: unknown): void {
    if (this.isLive(id)) {
      this.state = { kind: 'failed', view, failure: toCallFailure(error) };
    }
  }
}
