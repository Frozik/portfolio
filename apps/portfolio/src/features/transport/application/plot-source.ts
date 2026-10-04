import type { ISnapshotSource } from '@frozik/charts/data/snapshot/source';

import type { PlotView } from '../domain/plot';
import { pointsFor } from '../domain/plot';
import type { IPlotClient } from '../domain/ports/plot-client';

export interface PlotSourceOptions {
  readonly view: PlotView;
  readonly client: IPlotClient;
  readonly maxPoints: number;
  readonly now: () => number;
  readonly devicePixelRatio: () => number;
  readonly onSampled: (points: number, durationMs: number) => void;
  readonly onFailed: (error: unknown) => void;
}

/**
 * The chart's data: every window the chart asks for — on first show, after a
 * pan past what it holds, after a zoom that changes the density — is sampled
 * by the server anew, at one point per ten physical pixels of that window.
 */
export function createPlotSource(options: PlotSourceOptions): ISnapshotSource<number> {
  const { view, client, now } = options;
  return {
    async fetch(request) {
      const startedAt = now();
      const points = pointsFor(request.maxElements, options.devicePixelRatio(), options.maxPoints);
      try {
        const curve = await client.sample(
          { expression: view.expression, xMin: request.from, xMax: request.to, points },
          request.signal
        );
        options.onSampled(curve.x.length, now() - startedAt);
        return {
          data: {
            shape: 'point',
            points: curve.x.map((x, index) => ({ x, value: curve.y[index] ?? Number.NaN })),
          },
          range: { start: request.from, end: request.to },
        };
      } catch (error) {
        if (!request.signal.aborted) {
          options.onFailed(error);
        }
        throw error;
      }
    },
    subscribe: () => () => undefined,
  };
}
