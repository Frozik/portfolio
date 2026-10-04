import type { FileSinkStrategy } from '@frozik/utils/file-sink/file-sink';
import { makeAutoObservable, observableRef } from 'mobx';

import type { CallFailure } from '../domain/call-failure';
import { toCallFailure } from '../domain/call-failure';
import type { TransportProtocol } from '../domain/connection';
import type { EchoLimits, EchoResult } from '../domain/echo';
import { verifyEcho } from '../domain/echo';
import type { IClock } from '../domain/ports/clock';
import type { EchoCounters, EchoOutcome, IFileEcho } from '../domain/ports/file-echo';
import type { FileSinkOpener } from '../domain/ports/file-sink-opener';

export interface EchoProgress extends EchoCounters {
  readonly elapsedMs: number;
}

export type EchoState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'too-large'; readonly size: number }
  | { readonly kind: 'no-streaming-save' }
  | { readonly kind: 'opening' }
  | {
      readonly kind: 'running';
      readonly fileName: string;
      readonly size: number;
      readonly strategy: FileSinkStrategy;
      readonly progress: EchoProgress;
    }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly failure: CallFailure };

export interface EchoModelDependencies {
  readonly fileEcho: IFileEcho;
  readonly openSink: FileSinkOpener;
  readonly clock: IClock;
  /** The protocol under the transport right now, recorded with each finished echo. */
  readonly currentProtocol: () => TransportProtocol | undefined;
}

/** Progress is copied into observable state a few times a second, not once per chunk. */
const PROGRESS_REFRESH_MS = 200;

/** The echo panel's state: the chosen file, the echo in progress, the echoes finished so far. */
export class EchoModel {
  limits: EchoLimits | undefined;
  selected: File | undefined;
  state: EchoState = { kind: 'idle' };
  /** Finished echoes, newest first; they stay so runs can be compared. */
  results: readonly EchoResult[] = [];
  private inFlight: AbortController | undefined;
  private nextResultId = 1;

  constructor(private readonly dependencies: EchoModelDependencies) {
    makeAutoObservable<EchoModel, 'dependencies' | 'inFlight' | 'nextResultId'>(
      this,
      {
        dependencies: false,
        inFlight: false,
        nextResultId: false,
        state: observableRef,
        limits: observableRef,
        selected: observableRef,
        results: observableRef,
      },
      { autoBind: true }
    );
  }

  get isBusy(): boolean {
    return this.state.kind === 'opening' || this.state.kind === 'running';
  }

  get canStart(): boolean {
    return this.limits !== undefined && this.selected !== undefined && !this.isBusy;
  }

  async loadLimits(signal: AbortSignal): Promise<void> {
    this.setLimits(await this.dependencies.fileEcho.limits(signal));
  }

  select(file: File | undefined): void {
    this.selected = file;
    this.state = { kind: 'idle' };
  }

  /**
   * Call straight from a click: the save dialog needs that gesture, and
   * picking the file in the system dialog does not count as one everywhere.
   */
  async start(): Promise<void> {
    const { fileEcho, openSink, clock } = this.dependencies;
    const limits = this.limits;
    const file = this.selected;
    if (limits === undefined || file === undefined || this.isBusy) {
      return;
    }
    if (file.size > limits.maxFileBytes) {
      this.state = { kind: 'too-large', size: file.size };
      return;
    }

    this.state = { kind: 'opening' };
    const sink = await openSink(file);
    if (sink.kind !== 'opened') {
      this.setState(sink.kind === 'cancelled' ? { kind: 'idle' } : { kind: 'no-streaming-save' });
      return;
    }

    const controller = new AbortController();
    this.inFlight = controller;
    const startedAt = clock.now();
    let counters: EchoCounters = { sentBytes: 0, receivedBytes: 0 };
    const showProgress = () =>
      this.setState({
        kind: 'running',
        fileName: file.name,
        size: file.size,
        strategy: sink.strategy,
        progress: { ...counters, elapsedMs: clock.now() - startedAt },
      });
    showProgress();
    const stopProgress = clock.every(PROGRESS_REFRESH_MS, showProgress);

    try {
      const outcome = await fileEcho.echo({
        source: file,
        destination: sink.writable,
        maxChunkBytes: limits.maxChunkBytes,
        signal: controller.signal,
        onProgress: latest => {
          counters = latest;
        },
      });
      this.addResult(file.name, outcome, clock.now() - startedAt);
    } catch (error) {
      this.setState(
        controller.signal.aborted
          ? { kind: 'cancelled' }
          : { kind: 'failed', failure: toCallFailure(error) }
      );
    } finally {
      stopProgress();
      this.inFlight = undefined;
    }
  }

  cancel(): void {
    this.inFlight?.abort(new Error('cancelled'));
  }

  dispose(): void {
    this.cancel();
  }

  private addResult(fileName: string, { summary, tally }: EchoOutcome, elapsedMs: number): void {
    const result: EchoResult = {
      id: this.nextResultId++,
      fileName,
      verdict: verifyEcho(tally, summary),
      summary,
      elapsedMs,
      protocol: this.dependencies.currentProtocol(),
    };
    this.results = [result, ...this.results];
    this.state = { kind: 'idle' };
  }

  private setLimits(limits: EchoLimits): void {
    this.limits = limits;
  }

  private setState(state: EchoState): void {
    this.state = state;
  }
}
