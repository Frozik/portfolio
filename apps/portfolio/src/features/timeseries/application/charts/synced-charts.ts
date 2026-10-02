import { createChart } from '@frozik/charts/core/create-chart';
import { series } from '@frozik/charts/core/series/series';
import { timeDomain } from '@frozik/charts/data/timeseries/time-domain';
import { timeseries } from '@frozik/charts/data/timeseries/timeseries';
import { candleStyle } from '@frozik/charts/universal/marks/candleStyle';
import { lineStyle } from '@frozik/charts/universal/marks/lineStyle';

import { DAY, YEAR, YEAR_START } from '../../domain/demo-time';
import type { ISourceConditions } from '../demo-source';
import { demoSource } from '../demo-source';
import { createSyncGroup } from '../extensions/sync';
import { LIGHT_BLUE } from '../palette';
import { timeExtensions } from './time-extensions';

const SHOWN = 14n * DAY;
const SEEDS = ['sync-a', 'sync-b'] as const;

/** Two charts of different series that pan, zoom and point as one. */
export function createSyncedCharts(conditions: ISourceConditions) {
  const group = createSyncGroup<bigint>();
  const start = YEAR_START + YEAR / 2n;
  return SEEDS.map((seed, index) =>
    createChart({
      id: seed,
      x: { domain: timeDomain, start, end: start + SHOWN },
      series: [
        series({
          id: 'price',
          data: timeseries(demoSource({ seed, period: YEAR }, conditions), { retry: true }),
          style:
            index === 0
              ? lineStyle({ color: LIGHT_BLUE, size: 2 })
              : candleStyle({ width: 7, gap: 2 }),
        }),
      ],
      extensions: [...timeExtensions(), group.member()],
    })
  );
}
