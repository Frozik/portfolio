import { createChart } from '@frozik/charts/core/create-chart';
import type { ISeries } from '@frozik/charts/core/series/series';
import { series } from '@frozik/charts/core/series/series';
import type { ISeriesDataFactory } from '@frozik/charts/core/series/series-data';
import { timeDomain } from '@frozik/charts/data/timeseries/time-domain';
import { timeseries } from '@frozik/charts/data/timeseries/timeseries';
import { candleStyle } from '@frozik/charts/universal/marks/candleStyle';
import { lineStyle } from '@frozik/charts/universal/marks/lineStyle';
import { markerStyle } from '@frozik/charts/universal/marks/markerStyle';

import { memoize } from 'lodash-es';

import { DAY, YEAR, YEAR_START } from '../../domain/demo-time';
import { demoCache } from '../../infrastructure/demo-cache';
import type { ISourceConditions } from '../demo-source';
import { demoSource } from '../demo-source';
import { LIGHT_BLUE, ORANGE, TRANSLUCENT_GREEN, TRANSLUCENT_RED } from '../palette';
import { colorByValue, lineSizeByValue } from '../value-bands';
import { timeExtensions } from './time-extensions';

const CANDLE_WIDTH = 7;
const CANDLE_GAP = 2;
const BACKDROP_LINE_SIZE = 4;
const MARKER_SIZE = 9;
const MARKER_SPACING = 12;
const MID_YEAR = YEAR / 2n;

interface IOverviewScene {
  /** The stretch of the year shown at first, as offsets from its start. */
  readonly view: readonly [bigint, bigint];
  /** `dataOf` gives the data of a named series of the chart: the same name is the same data, another name another series. */
  series(dataOf: (name: string) => ISeriesDataFactory<bigint>): readonly ISeries<bigint>[];
}

function around(center: bigint, length: bigint): readonly [bigint, bigint] {
  return [center - length / 2n, center + length / 2n];
}

const SCENES: readonly IOverviewScene[] = [
  {
    view: [0n, YEAR],
    series: dataOf => [
      series({
        id: 'price',
        data: dataOf('price'),
        style: lineStyle({ color: LIGHT_BLUE, size: BACKDROP_LINE_SIZE }),
      }),
      series({
        id: 'candles',
        data: dataOf('candles'),
        style: candleStyle({
          width: CANDLE_WIDTH,
          gap: CANDLE_GAP,
          up: TRANSLUCENT_GREEN,
          down: TRANSLUCENT_RED,
        }),
      }),
    ],
  },
  {
    view: around(MID_YEAR, 90n * DAY),
    series: dataOf => [
      series({
        id: 'candles',
        data: dataOf('candles'),
        style: candleStyle({ width: CANDLE_WIDTH, gap: CANDLE_GAP }),
      }),
    ],
  },
  {
    view: around(MID_YEAR, 30n * DAY),
    series: dataOf => [
      series({
        id: 'price',
        data: dataOf('price'),
        style: lineStyle({ color: ORANGE, size: sample => lineSizeByValue(sample.value) }),
      }),
    ],
  },
  {
    view: around(MID_YEAR, 7n * DAY),
    series: dataOf => [
      series({
        id: 'price',
        data: dataOf('price'),
        style: markerStyle({
          figure: 'rhombus',
          size: MARKER_SIZE,
          spacing: MARKER_SPACING,
          color: sample => colorByValue(sample.value),
        }),
      }),
    ],
  },
];

export const OVERVIEW_CHART_COUNT = SCENES.length;

/** One of the four charts of the overview: its own noise, its own stretch of the year, its own look. */
export function createOverviewChart(index: number, conditions: ISourceConditions) {
  const scene = SCENES[index];
  const [start, end] = scene.view;
  const dataOf = memoize((name: string) =>
    timeseries(demoSource({ seed: `chart-${index}-${name}`, period: YEAR }, conditions), {
      key: `overview-${index}-${name}`,
      retry: true,
      cache: { persistent: demoCache },
    })
  );
  return createChart({
    id: `overview-${index}`,
    x: { domain: timeDomain, start: YEAR_START + start, end: YEAR_START + end },
    series: scene.series(dataOf),
    extensions: timeExtensions(),
  });
}
