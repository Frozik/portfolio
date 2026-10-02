import { ChartDataError } from '@frozik/charts/core/series/data-error';
import { makeAutoObservable } from 'mobx';

export type TDemoPage = 'overview' | 'workspace' | 'marks' | 'live' | 'snapshot' | 'sync';

export const DEMO_PAGES: readonly TDemoPage[] = [
  'overview',
  'workspace',
  'marks',
  'live',
  'snapshot',
  'sync',
];

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 1500;

/** What every page of the demo shares: which page is shown and the switches of the debug panel. */
export class TimeseriesDemoStore {
  page: TDemoPage = 'overview';
  /** The row of page buttons is shown; hidden until asked for, so that it takes no room from the charts. */
  isPageMenuOpen = false;
  /** Marks where each run of data begins. */
  debug = false;
  /** Sources answer after a pause, as a server would. */
  loadingDelay = false;
  /** The charts are drawn by the 2D canvas alone, as on a device without WebGPU. */
  canvasOnly = false;
  /** Sources reject every request, as a server that is down would. */
  sourceFailures = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setPage(page: TDemoPage): void {
    this.page = page;
  }

  togglePageMenu(): void {
    this.isPageMenuOpen = !this.isPageMenuOpen;
  }

  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  setLoadingDelay(loadingDelay: boolean): void {
    this.loadingDelay = loadingDelay;
  }

  setCanvasOnly(canvasOnly: boolean): void {
    this.canvasOnly = canvasOnly;
  }

  setSourceFailures(sourceFailures: boolean): void {
    this.sourceFailures = sourceFailures;
  }

  /** What the next request of a demo source is rejected with; nothing while the sources are up. */
  failure(): ChartDataError | undefined {
    return this.sourceFailures
      ? new ChartDataError('UNAVAILABLE', 'the demo source is switched off')
      : undefined;
  }

  /** How long the next answer of a demo source takes. */
  delayMs(): number {
    return this.loadingDelay ? MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) : 0;
  }
}
