import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';

import type { IBreadcrumb } from '../core/breadcrumb';
import type { TNow } from '../core/clock';
import type { IDiagnosticsSource } from '../core/ports';
import type {
  IConsoleEntry,
  IDiagnosticsCounts,
  IDiagnosticsSnapshot,
  IErrorEntry,
  INetworkEntry,
} from '../core/report';
import { RingBuffer } from '../core/ring-buffer';
import type { IBreadcrumbOptions } from './breadcrumbs';
import { captureBreadcrumbs } from './breadcrumbs';
import { captureConsole, coalesceConsole } from './console';
import { createGpuInfoReader, snapshotEnvironment } from './environment';
import { captureErrors, coalesceErrors } from './errors';
import { FpsSampler } from './fps';
import { captureNetwork } from './network';
import { PerformanceCollector } from './performance';
import { WebVitalsCollector } from './web-vitals';

export interface IDiagnosticsLimits {
  readonly consoleEntries: number;
  readonly consoleBytes: number;
  readonly errorEntries: number;
  readonly breadcrumbEntries: number;
  readonly networkEntries: number;
}

const KILOBYTE = 1_024;

export const DEFAULT_DIAGNOSTICS_LIMITS: IDiagnosticsLimits = {
  consoleEntries: 200,
  consoleBytes: 256 * KILOBYTE,
  errorEntries: 50,
  breadcrumbEntries: 150,
  networkEntries: 100,
};

export interface IDiagnosticsHubOptions extends IBreadcrumbOptions {
  readonly now: TNow;
  readonly limits: IDiagnosticsLimits;
}

/**
 * Runs every collector from the moment it is created, so a report carries
 * the history that led to the bug, not only what happened after the click.
 */
export class DiagnosticsHub implements IDiagnosticsSource {
  private readonly console: RingBuffer<IConsoleEntry>;
  private readonly errors: RingBuffer<IErrorEntry>;
  private readonly breadcrumbs: RingBuffer<IBreadcrumb>;
  private readonly network: RingBuffer<INetworkEntry>;
  private readonly performance = new PerformanceCollector();
  private readonly vitals = new WebVitalsCollector();
  private readonly fps = new FpsSampler();
  private readonly gpu = createGpuInfoReader();
  private readonly bag = new DisposableBag();
  private lastFps: ReturnType<FpsSampler['stop']> = null;

  constructor(private readonly options: IDiagnosticsHubOptions) {
    const { limits, now } = options;
    this.console = new RingBuffer({
      maxEntries: limits.consoleEntries,
      maxBytes: limits.consoleBytes,
      sizeOf: entry => entry.message.length,
      coalesce: coalesceConsole,
    });
    this.errors = new RingBuffer({ maxEntries: limits.errorEntries, coalesce: coalesceErrors });
    this.breadcrumbs = new RingBuffer({ maxEntries: limits.breadcrumbEntries });
    this.network = new RingBuffer({ maxEntries: limits.networkEntries });
    this.bag.add(() => this.performance.dispose());
    this.bag.add(captureConsole(entry => this.console.push(entry), now));
    this.bag.add(captureErrors(entry => this.errors.push(entry), now));
    this.bag.add(captureBreadcrumbs(crumb => this.breadcrumbs.push(crumb), now, options));
    this.bag.add(captureNetwork(entry => this.network.push(entry), now));
  }

  startFrameSampling(): void {
    this.fps.start();
  }

  stopFrameSampling(): void {
    this.lastFps = this.fps.stop();
  }

  counts(): IDiagnosticsCounts {
    return {
      console: this.console.size,
      errors: this.errors.size,
      breadcrumbs: this.breadcrumbs.size,
      network: this.network.size,
      performance: this.performance.longFrameCount + this.vitals.snapshot().length,
    };
  }

  async snapshot(): Promise<IDiagnosticsSnapshot> {
    return {
      console: this.console.toArray(),
      errors: this.errors.toArray(),
      breadcrumbs: this.breadcrumbs.toArray(),
      network: this.network.toArray(),
      performance: this.performance.snapshot(this.vitals.snapshot(), this.lastFps),
      environment: await snapshotEnvironment(this.options.now, this.gpu),
    };
  }

  dispose(): void {
    this.fps.stop();
    this.bag.disposeAll();
  }
}
