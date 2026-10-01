import { makeAutoObservable, observableRef } from 'mobx';

import type { Benchmark } from '../domain/benchmark';
import { advance, INITIAL_BENCHMARK, trianglesToDraw } from '../domain/benchmark';
import type { GpuCapabilities, GpuFailure, GpuStatus, WebGlInfo } from '../domain/gpu-capabilities';
import { GPU_PENDING } from '../domain/gpu-capabilities';
import { refreshRateOf } from '../domain/refresh-rate';

/** The canvas the test draws into: the count that holds depends on how many pixels there are. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

/**
 * What the panel shows: the test's progress and result, the frame rate, and
 * what the renderer found out about the graphics card. The renderer feeds it
 * a frame at a time and reads back how many triangles to draw.
 */
export class SunStore {
  benchmark: Benchmark = INITIAL_BENCHMARK;
  fps = 0;
  viewport: Viewport | undefined = undefined;
  gpu: GpuStatus = GPU_PENDING;
  webgl: WebGlInfo | undefined = undefined;

  constructor() {
    makeAutoObservable(
      this,
      { benchmark: observableRef, viewport: observableRef, gpu: observableRef },
      { autoBind: true }
    );
  }

  get triangles(): number {
    return trianglesToDraw(this.benchmark);
  }

  get phase(): Benchmark['phase'] {
    return this.benchmark.phase;
  }

  /** The display's rate in hertz, once it has been read. */
  get refreshRate(): number | undefined {
    return this.benchmark.phase === 'calibrating'
      ? undefined
      : refreshRateOf(this.benchmark.refreshIntervalMs);
  }

  /** The most triangles seen to hold the display's rate so far. */
  get holds(): number {
    return this.benchmark.phase === 'calibrating' ? 0 : this.benchmark.holds;
  }

  /** The search ran out of triangles to add before the card ran out of speed. */
  get isCapped(): boolean {
    return this.benchmark.phase === 'finished' && this.benchmark.isCapped;
  }

  frame(nowMs: number): void {
    this.benchmark = advance(this.benchmark, nowMs);
  }

  restart(): void {
    this.benchmark = INITIAL_BENCHMARK;
  }

  /** Another canvas is another load: what was measured on the old one says nothing of it. */
  resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.restart();
  }

  reportFps(fps: number): void {
    this.fps = fps;
  }

  gpuFound(capabilities: GpuCapabilities): void {
    this.gpu = { kind: 'ready', capabilities };
  }

  gpuMissing(failure: GpuFailure): void {
    this.gpu = { kind: 'unavailable', failure };
  }

  webGlFound(webgl: WebGlInfo | undefined): void {
    this.webgl = webgl;
  }

  dispose(): void {}
}
