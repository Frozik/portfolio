import type { IChartViewport } from '../../domain/types';

/** The one writable home of a chart's viewport; readers get immutable snapshots. */
export class ViewportState {
  private viewport: IChartViewport;

  constructor(initial: IChartViewport) {
    this.viewport = initial;
  }

  get current(): IChartViewport {
    return this.viewport;
  }

  update(patch: Partial<IChartViewport>): void {
    this.viewport = { ...this.viewport, ...patch };
  }
}
