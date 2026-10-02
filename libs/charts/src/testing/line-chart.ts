import type { TAnyExtension } from '../core/chart-options';
import { createChart } from '../core/create-chart';
import type { IChartSize } from '../core/host/size-source';
import { series } from '../core/series/series';
import type { ISeriesDataFactory } from '../core/series/series-data';
import { numberDomain } from '../core/viewport/number-domain';
import { staticData } from '../data/static-data';
import { LINE_MARK } from '../marks/line/core';
import { createLineStyle } from '../marks/line/style';
import { createFakeHost } from './fake-host';

const DEFAULT_SIZE: IChartSize = { width: 1000, height: 500, devicePixelRatio: 1 };
const DEFAULT_DATA = staticData<number>({
  shape: 'point',
  points: [
    { x: 0, value: 10 },
    { x: 50, value: 30 },
    { x: 100, value: 20 },
  ],
});

export interface ILineChartOptions {
  readonly data?: ISeriesDataFactory<number>;
  readonly size?: IChartSize;
}

/** A mounted chart with one line over a numeric axis showing 0…100: the scene extension tests start from. */
export function mountLineChart<const TExtensions extends readonly TAnyExtension<number>[]>(
  extensions: TExtensions,
  options: ILineChartOptions = {}
) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    series: [
      series({
        id: 'line',
        data: options.data ?? DEFAULT_DATA,
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions,
  });
  const host = createFakeHost(options.size ?? DEFAULT_SIZE);
  chart.attach(host);
  return { chart, host };
}
