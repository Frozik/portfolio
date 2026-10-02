import { createChart } from '@frozik/charts/core/create-chart';
import { series } from '@frozik/charts/core/series/series';
import type { IStyleProcessor } from '@frozik/charts/core/series/style-processor';
import { timeDomain } from '@frozik/charts/data/timeseries/time-domain';
import { TIME_SCALES } from '@frozik/charts/data/timeseries/time-scale';
import { timeseries } from '@frozik/charts/data/timeseries/timeseries';
import { followTail } from '@frozik/charts/extensions/follow-tail/core';
import { areaStyle } from '@frozik/charts/universal/marks/areaStyle';
import { candleStyle } from '@frozik/charts/universal/marks/candleStyle';
import { lineStyle } from '@frozik/charts/universal/marks/lineStyle';
import { stairsStyle } from '@frozik/charts/universal/marks/stairsStyle';
import { Temporal } from 'temporal-polyfill';

import { MINUTE, SECOND } from '../../domain/demo-time';
import type { ISourceConditions } from '../demo-source';
import { demoSource } from '../demo-source';
import { AREA_BLUE, LIGHT_BLUE, TRANSLUCENT_GREEN, TRANSLUCENT_RED } from '../palette';
import { timeExtensions } from './time-extensions';

const NOISE_PERIOD = 10n * MINUTE;
const SHOWN = 3n * MINUTE;
const MIN_SHOWN = 10n * SECOND;
/** Room kept to the right of the newest element, as a share of what is shown, so it is not glued to the edge. */
const HEADROOM = 0.1;
const PERCENT = 100;
/** How long the view takes to catch up with a new element. */
const GLIDE_MS = 800;
const LINE_SIZE = 2;

export type TLiveStyle = 'line' | 'stairs' | 'area';

export const LIVE_STYLES: Readonly<Record<TLiveStyle, IStyleProcessor<bigint>>> = {
  line: lineStyle({ color: LIGHT_BLUE, size: LINE_SIZE }),
  stairs: stairsStyle({ color: LIGHT_BLUE, size: LINE_SIZE }),
  area: areaStyle({ color: AREA_BLUE, line: { color: LIGHT_BLUE, size: LINE_SIZE } }),
};

export const PRICE_SERIES = 'price';

function now(): bigint {
  return Temporal.Now.instant().epochNanoseconds;
}

/** A series that ends at this very moment and keeps growing: a line and candles over the same data, following its tail. */
export function createLiveChart(conditions: ISourceConditions) {
  const data = timeseries(demoSource({ seed: 'live', period: NOISE_PERIOD, now }, conditions), {
    retry: true,
    scales: TIME_SCALES.filter(scale => scale >= SECOND),
  });
  const end = now() + (SHOWN * BigInt(HEADROOM * PERCENT)) / BigInt(PERCENT);
  return createChart({
    id: 'live',
    x: { domain: timeDomain, start: end - SHOWN, end },
    series: [
      series({ id: PRICE_SERIES, data, style: LIVE_STYLES.line }),
      series({
        id: 'candles',
        data,
        style: candleStyle({ width: 9, gap: 3, up: TRANSLUCENT_GREEN, down: TRANSLUCENT_RED }),
      }),
    ],
    extensions: [
      ...timeExtensions({ minRange: MIN_SHOWN, timeZone: Temporal.Now.timeZoneId() }),
      followTail<bigint>({ headroom: HEADROOM, glideMs: GLIDE_MS }),
    ],
  });
}
