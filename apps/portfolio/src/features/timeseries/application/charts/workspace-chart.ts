import { annotations } from '@frozik/charts/canvas2d/extensions/annotations/annotations';
import { axes } from '@frozik/charts/canvas2d/extensions/axes/axes';
import { crosshair } from '@frozik/charts/canvas2d/extensions/crosshair/crosshair';
import { legend } from '@frozik/charts/canvas2d/extensions/legend/legend';
import { loadingIndicator } from '@frozik/charts/canvas2d/extensions/loading-indicator/loadingIndicator';
import { createChart } from '@frozik/charts/core/create-chart';
import { rgba } from '@frozik/charts/core/series/color';
import { series } from '@frozik/charts/core/series/series';
import type { ISchedule } from '@frozik/charts/core/timeline/schedule';
import { schedule } from '@frozik/charts/core/timeline/schedule-cuts';
import { timeseries } from '@frozik/charts/data/timeseries/timeseries';
import { autoScaleY } from '@frozik/charts/extensions/auto-scale-y/core';
import { bounds } from '@frozik/charts/extensions/bounds/core';
import { panZoom } from '@frozik/charts/extensions/pan-zoom/core';
import { scaleZoom } from '@frozik/charts/extensions/scale-zoom/core';
import { smoothZoom } from '@frozik/charts/extensions/smooth-zoom/core';
import { ticks } from '@frozik/charts/extensions/ticks/core';
import { timeTicks } from '@frozik/charts/extensions/ticks/time-ticks';
import { cuts } from '@frozik/charts/universal/extensions/cuts';
import { debugBlocks } from '@frozik/charts/universal/extensions/debugBlocks';
import { grid } from '@frozik/charts/universal/extensions/grid';
import { candleStyle } from '@frozik/charts/universal/marks/candleStyle';
import { columnStyle } from '@frozik/charts/universal/marks/columnStyle';
import { lineStyle } from '@frozik/charts/universal/marks/lineStyle';
import { EDayOfWeek } from '@frozik/utils/date/constants';

import { DAY, MINUTE, YEAR, YEAR_START } from '../../domain/demo-time';
import type { ISourceConditions } from '../demo-source';
import { demoSource } from '../demo-source';
import { GREEN, LIGHT_BLUE, ORANGE, RED } from '../palette';
import { localTimeDomain } from './local-time-domain';

const SHOWN = 60n * DAY;
/** The exchange keeps New York hours, whatever clock the visitor reads the chart by: nights and weekends are cut out of the axis. */
const SESSIONS: ISchedule = {
  timeZone: 'America/New_York',
  entries: [
    {
      kind: 'weekly',
      effect: 'open',
      days: [
        EDayOfWeek.Monday,
        EDayOfWeek.Tuesday,
        EDayOfWeek.Wednesday,
        EDayOfWeek.Thursday,
        EDayOfWeek.Friday,
      ],
      from: '09:30',
      to: '20:00',
    },
  ],
};
const CENTER = 100;
const CANDLE_WIDTH = 7;
const CANDLE_GAP = 2;
const VIOLET = rgba(0.7, 0.5, 1);
const VOLUME_BLUE = rgba(0.3, 0.55, 0.95, 0.7);
const FAINT_GREEN = rgba(0.2, 0.8, 0.3, 0.75);
const FAINT_RED = rgba(0.9, 0.2, 0.2, 0.75);
/** How many orders of magnitude the growth curve runs through per swing of the noise. */
const GROWTH_DECADES_PER_SWING = 15;
const LIMIT_LEVEL = 104;
const SUPPORT_LEVEL = 96;
/** The momentum scale is fixed at both ends: the histogram keeps its height whatever is in view. */
const MOMENTUM_REACH = 20;
const THOUSAND = 1000;

/** A volume the short way: 12.5K rather than 12,500. */
function compact(value: number): string {
  return value >= THOUSAND
    ? `${Number((value / THOUSAND).toFixed(1))}K`
    : String(Math.round(value));
}

/** Noise round a hundred as a volume: never negative, quiet when the series is. */
function volumeOf(noise: number): number {
  return Math.abs(noise - CENTER) * THOUSAND;
}

/** Noise round a hundred as a momentum: positive above the centre, negative below. */
function momentumOf(noise: number): number {
  return noise - CENTER;
}

/** Noise as a curve that grows by orders of magnitude: what a logarithmic scale is for. */
function growthOf(noise: number): number {
  return 10 ** ((noise - CENTER) / GROWTH_DECADES_PER_SWING + 2);
}

/**
 * One chart, three panes on a shared time axis. The price pane holds four
 * series against four value scales — two on the right, two on the left, one
 * of them in per cent, one logarithmic and one running downwards — the panes
 * below hold a volume on a scale that starts at nought and writes thousands
 * short, and a histogram on a scale fixed at both ends. A legend reads every series at the element the crosshair
 * snaps to; a limit, a support level and three events are marked.
 */
export function createWorkspaceChart(conditions: ISourceConditions) {
  const domain = localTimeDomain();
  const sessions = schedule(SESSIONS).mappingOf(domain);
  const start = YEAR_START + YEAR / 2n;
  const end = start + SHOWN;
  const dataOf = (seed: string, shape?: (noise: number) => number) =>
    timeseries(demoSource({ seed, period: YEAR, shape, sessions }, conditions), { retry: true });
  const price = dataOf('workspace-price');

  return createChart({
    id: 'workspace',
    x: { domain, cuts: schedule(SESSIONS), start, end },
    panes: [{ id: 'price', weight: 3 }, { id: 'volume' }, { id: 'momentum' }],
    scales: [
      { id: 'price', side: 'right', title: 'USD' },
      { id: 'benchmark', side: 'right', labels: 'percent', color: ORANGE },
      { id: 'growth', side: 'left', kind: 'log', color: VIOLET, title: 'log' },
      { id: 'rate', side: 'left', color: LIGHT_BLUE, inverted: true, title: 'rate ↓' },
      { id: 'volume', pane: 'volume', side: 'right', min: 0, padding: 0.2, format: compact },
      {
        id: 'momentum',
        pane: 'momentum',
        side: 'right',
        min: -MOMENTUM_REACH,
        max: MOMENTUM_REACH,
      },
    ],
    series: [
      series({
        id: 'price',
        name: 'Price',
        data: price,
        style: candleStyle({ width: CANDLE_WIDTH, gap: CANDLE_GAP }),
      }),
      series({
        id: 'benchmark',
        name: 'Benchmark',
        scale: 'benchmark',
        data: dataOf('workspace-benchmark'),
        style: lineStyle({ color: ORANGE, size: 2 }),
      }),
      series({
        id: 'growth',
        name: 'Growth (log)',
        scale: 'growth',
        data: dataOf('workspace-growth', growthOf),
        style: lineStyle({ color: VIOLET, size: 2 }),
      }),
      series({
        id: 'rate',
        name: 'Rate',
        scale: 'rate',
        data: dataOf('workspace-rate', momentumOf),
        style: lineStyle({ color: LIGHT_BLUE, size: 1.5, join: 'stepAfter' }),
      }),
      series({
        id: 'volume',
        name: 'Volume',
        scale: 'volume',
        data: dataOf('workspace-volume', volumeOf),
        style: columnStyle({ color: VOLUME_BLUE, width: CANDLE_WIDTH, gap: CANDLE_GAP }),
      }),
      series({
        id: 'momentum',
        name: 'Momentum',
        scale: 'momentum',
        data: dataOf('workspace-momentum', momentumOf),
        style: columnStyle({
          baseline: 0,
          width: CANDLE_WIDTH,
          gap: CANDLE_GAP,
          color: sample => (sample.value >= 0 ? FAINT_GREEN : FAINT_RED),
        }),
      }),
    ],
    extensions: [
      ticks({ x: timeTicks() }),
      grid<bigint>(),
      cuts<bigint>(),
      axes<bigint>(),
      annotations<bigint>({
        levels: [
          { value: LIMIT_LEVEL, scale: 'price', label: `limit ${LIMIT_LEVEL}`, color: RED },
          { value: SUPPORT_LEVEL, scale: 'price', label: `support ${SUPPORT_LEVEL}`, color: GREEN },
          { value: 0, scale: 'momentum' },
        ],
        events: [
          { x: start + 9n * DAY, label: 'E' },
          { x: start + 27n * DAY, label: 'D', color: ORANGE },
          { x: start + 44n * DAY, label: 'S', color: VIOLET },
        ],
      }),
      legend<bigint>(),
      crosshair<bigint>({ snap: ['price', 'benchmark'] }),
      loadingIndicator<bigint>(),
      debugBlocks<bigint>(),
      panZoom<bigint>(),
      scaleZoom<bigint>(),
      smoothZoom<bigint>(),
      bounds<bigint>({ minRange: Number(MINUTE) }),
      autoScaleY<bigint>(),
    ],
  });
}
