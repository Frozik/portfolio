import { createChart } from '@frozik/charts/core/create-chart';
import { rgba, withAlpha } from '@frozik/charts/core/series/color';
import type { ISeries } from '@frozik/charts/core/series/series';
import { series } from '@frozik/charts/core/series/series';
import { staticData } from '@frozik/charts/data/static-data';
import type { TFigure } from '@frozik/charts/marks/marker/figures';
import { POLYGON_FIGURES } from '@frozik/charts/marks/marker/figures';
import { areaStyle } from '@frozik/charts/universal/marks/areaStyle';
import { candleStyle } from '@frozik/charts/universal/marks/candleStyle';
import { lineStyle } from '@frozik/charts/universal/marks/lineStyle';
import { markerStyle } from '@frozik/charts/universal/marks/markerStyle';
import { ringStyle } from '@frozik/charts/universal/marks/ringStyle';
import { stairsStyle } from '@frozik/charts/universal/marks/stairsStyle';

import { HOUR, MINUTE, YEAR_START } from '../../domain/demo-time';
import { AREA_BLUE, BLUE, GREEN, LIGHT_BLUE, ORANGE, RED, WHITE } from '../palette';
import { localTimeDomain } from './local-time-domain';
import { timeExtensions } from './time-extensions';

const COUNT = 60;
const END = YEAR_START + BigInt(COUNT) * HOUR;
/** Three points in a row are missing: where a line breaks and no marker stands. */
const GAP = { from: 21, to: 23 };
const CENTER = 100;
const FAINT_WHITE = rgba(1, 1, 1, 0.6);
const SKY = rgba(0.2, 0.7, 0.9);
const FIGURES: readonly TFigure[] = ['circle', ...POLYGON_FIGURES];
const FIGURE_COLORS = [SKY, ORANGE, GREEN, RED, WHITE] as const;
const FIGURE_SIZE = 22;
const MIN_FIGURE_SIZE = 10;
const FIGURE_SIZE_STEP = 1.25;
/** Clear of the value labels on the left; the rows of a column a minute apart, so a run stays in order. */
const FIRST_FIGURE_AT = 6n * HOUR;
const FIGURE_STRIDE = 235n * MINUTE;
const MAX_STROKE_SIZE = 4;
const FIGURE_TABLE_PADDING = 0.3;

/** A slow wave with a ripple on it; `phase` moves the slow wave along. */
function wave(index: number, phase = 0): number {
  return CENTER + Math.sin(index / 6 + phase) * 10 + Math.sin(index / 2) * 2;
}

function timeOf(index: number): bigint {
  return YEAR_START + BigInt(index) * HOUR;
}

const points = staticData<bigint>({
  shape: 'point',
  points: Array.from({ length: COUNT }, (_, index) => ({
    x: timeOf(index),
    value: index >= GAP.from && index <= GAP.to ? Number.NaN : wave(index),
  })),
});

function candlesOf(phase: number) {
  return staticData<bigint>(
    {
      shape: 'candle',
      candles: Array.from({ length: COUNT }, (_, index) => {
        const open = wave(index, phase);
        const close = wave(index + 1, phase);
        return {
          x: timeOf(index),
          open,
          close,
          min: Math.min(open, close) - 1.5,
          max: Math.max(open, close) + 1,
        };
      }),
    },
    { step: Number(HOUR) }
  );
}

const candles = candlesOf(0);
/** A second series of candles a sixth of a turn ahead, so what is drawn from it does not hide behind the first. */
const shiftedCandles = candlesOf(Math.PI / 3);

/** What a row of the figure table shows; the same three for every figure. */
const FIGURE_ROWS = [
  { value: 90, look: 'filled' },
  { value: 100, look: 'outlined' },
  { value: 110, look: 'hollow' },
] as const;

function lookOf(row: number) {
  return FIGURE_ROWS[row].look;
}

/**
 * Every figure in a column of three, each row another use of fill and stroke.
 * Bottom: fill alone, a colour and a size per figure. Middle: fill and a
 * stroke of another colour, the stroke one to four pixels thick. Top: the
 * same fill at alpha nought — a hollow figure is nothing but that — under a
 * stroke of the figure's colour.
 */
const figures = FIGURES.map((figure, order) => {
  const color = FIGURE_COLORS[order % FIGURE_COLORS.length];
  const contrast = FIGURE_COLORS[(order + 2) % FIGURE_COLORS.length];
  const strokeSize = 1 + (order % MAX_STROKE_SIZE);
  return series({
    id: figure,
    data: staticData<bigint>({
      shape: 'point',
      points: FIGURE_ROWS.map((row, index) => ({
        x: YEAR_START + FIRST_FIGURE_AT + BigInt(order) * FIGURE_STRIDE + BigInt(index) * MINUTE,
        value: row.value,
      })),
    }),
    style: markerStyle({
      figure,
      size: (_sample, row) =>
        lookOf(row) === 'filled' ? MIN_FIGURE_SIZE + order * FIGURE_SIZE_STEP : FIGURE_SIZE,
      color: (_sample, row) => (lookOf(row) === 'hollow' ? withAlpha(color, 0) : color),
      stroke: {
        size: (_sample, row) => (lookOf(row) === 'filled' ? 0 : strokeSize),
        color: (_sample, row) => (lookOf(row) === 'outlined' ? contrast : color),
      },
    }),
  });
});

interface IMarksScene {
  readonly series: readonly ISeries<bigint>[];
  /** Room above and below the data, where the default would put marks under the axis labels. */
  readonly valuePadding?: number;
}

/** The four scenes of the gallery, each showing marks the overview does not. */
const SCENES: readonly IMarksScene[] = [
  {
    series: [
      series({
        id: 'area',
        data: points,
        style: areaStyle({ color: AREA_BLUE, line: { color: BLUE, size: 2 } }),
      }),
      series({ id: 'stairs', data: points, style: stairsStyle({ color: ORANGE, size: 2 }) }),
    ],
  },
  {
    series: [
      series({ id: 'candles', data: candles, style: candleStyle({ width: 9, gap: 2 }) }),
      series({
        id: 'line-through-candles',
        data: shiftedCandles,
        style: lineStyle({ shape: 'candle', color: FAINT_WHITE, size: 1.5 }),
      }),
      series({
        id: 'rings-on-candles',
        data: shiftedCandles,
        style: ringStyle({ shape: 'candle', color: LIGHT_BLUE, size: 5, width: 1 }),
      }),
    ],
  },
  {
    series: [
      series({
        id: 'rings',
        data: points,
        style: ringStyle({ color: ORANGE, size: 12, width: 2 }),
      }),
      ...figures,
    ],
    valuePadding: FIGURE_TABLE_PADDING,
  },
  {
    series: [
      series({
        id: 'outlined',
        data: points,
        style: lineStyle({
          color: ORANGE,
          size: sample => 2 + Math.abs(sample.value - CENTER),
          stroke: { color: WHITE, size: 1.5 },
        }),
      }),
    ],
  },
];

export const MARKS_CHART_COUNT = SCENES.length;

/** One chart of the gallery of marks, over a fixed set of sixty hourly elements. */
export function createMarksChart(index: number) {
  return createChart({
    id: `marks-${index}`,
    x: { domain: localTimeDomain(), start: YEAR_START, end: END },
    series: SCENES[index].series,
    extensions: timeExtensions({ minRange: HOUR, valuePadding: SCENES[index].valuePadding }),
  });
}
