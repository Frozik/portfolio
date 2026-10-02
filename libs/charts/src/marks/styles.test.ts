import { describe, expect, it } from 'vitest';

import { darkTheme } from '../core/frame/dark-theme';
import { rgba } from '../core/series/color';
import type { TBatch } from '../core/series/shape';
import { runOfBatch, styled } from '../testing/styled';
import { AREA_MARK, areaOptionsOf } from './area/core';
import { createAreaStyle } from './area/style';
import { CANDLE_MARK, candleOptionsOf } from './candle/core';
import { createCandleStyle } from './candle/style';
import { COLUMN_MARK, columnOptionsOf } from './column/core';
import { createColumnStyle } from './column/style';
import { LINE_MARK, lineOptionsOf } from './line/core';
import { createStairsStyle } from './line/stairs-style';
import { createLineStyle } from './line/style';
import { MARKER_MARK, markerOptionsOf } from './marker/core';
import { FIGURE_POLYGONS, POLYGON_FIGURES } from './marker/figures';
import { createMarkerStyle, createRingStyle } from './marker/style';

const RED = rgba(1, 0, 0);
const BLUE = rgba(0, 0, 1);

const POINTS: TBatch<number> = {
  shape: 'point',
  points: [
    { x: 0, value: 10 },
    { x: 1, value: Number.NaN },
    { x: 2, value: 30 },
  ],
};

const CANDLES: TBatch<number> = {
  shape: 'candle',
  candles: [
    { x: 0, open: 10, min: 5, max: 20, close: 15 },
    { x: 1, open: 15, min: 8, max: 16, close: 9 },
  ],
};

describe('the line style', () => {
  it('draws from points with one colour and one size unless told otherwise', () => {
    const processor = createLineStyle<number>(LINE_MARK, { color: RED, size: 3 });

    const style = styled(processor, POINTS);

    expect(processor.shape).toBe('point');
    expect(style.marks.map(use => use.mark.id)).toEqual(['line']);
    expect(style.fill).toEqual({ color: RED, size: 3 });
    expect(style.stroke.size).toBe(0);
  });

  it('gives every element its own colour and size when they are functions', () => {
    const style = styled(
      createLineStyle<number>(LINE_MARK, {
        color: (_sample, index) => (index === 0 ? RED : BLUE),
        size: sample => (Number.isNaN(sample.value) ? 0 : sample.value / 10),
      }),
      POINTS
    );

    expect(style.fill.color).toEqual(Uint32Array.from([RED, BLUE, BLUE]));
    expect(style.fill.size).toEqual(Float32Array.from([1, 0, 3]));
  });

  it('shows a candle to style functions as its four values, the close being its value', () => {
    const seen: number[][] = [];
    styled(
      createLineStyle<number>(LINE_MARK, {
        shape: 'candle',
        color: sample => {
          seen.push([sample.open, sample.min, sample.max, sample.close, sample.value]);
          return RED;
        },
      }),
      CANDLES
    );

    expect(seen[0]).toEqual([10, 5, 20, 15, 15]);
  });

  it('carries an outline as the stroke', () => {
    const style = styled(
      createLineStyle<number>(LINE_MARK, { stroke: { color: BLUE, size: 2 } }),
      POINTS
    );

    expect(style.stroke).toEqual({ color: BLUE, size: 2 });
  });

  it('becomes stairs by holding each value until the next point', () => {
    const [use] = styled(createStairsStyle<number>(LINE_MARK), POINTS).marks;

    expect(lineOptionsOf(use.options)).toEqual({ join: 'stepAfter', paint: 'fill' });
  });
});

describe('the area style', () => {
  const marks = { area: AREA_MARK, line: LINE_MARK };

  it('is a band alone, and a band with a line along its edge when asked', () => {
    const plain = styled(createAreaStyle<number>(marks), POINTS);
    const edged = styled(createAreaStyle<number>(marks, { line: { color: RED, size: 2 } }), POINTS);

    expect(plain.marks.map(use => use.mark.id)).toEqual(['area']);
    expect(edged.marks.map(use => use.mark.id)).toEqual(['area', 'line']);
    expect(lineOptionsOf(edged.marks[1].options).paint).toBe('stroke');
    expect(edged.stroke).toEqual({ color: RED, size: 2 });
  });

  it('reaches down to a baseline given as a value when the axis is fitted', () => {
    const run = runOfBatch(POINTS);

    expect(AREA_MARK.valueRange(run, 0, 3, { baseline: 0, join: 'linear' })).toEqual({
      min: 0,
      max: 30,
    });
    expect(AREA_MARK.valueRange(run, 0, 3, areaOptionsOf(undefined))).toEqual({ min: 10, max: 30 });
  });
});

describe('the marker style', () => {
  it('is a circle unless a figure is named', () => {
    const [circle] = styled(createMarkerStyle<number>(MARKER_MARK), POINTS).marks;
    const [star] = styled(createMarkerStyle<number>(MARKER_MARK, { figure: 'star' }), POINTS).marks;

    expect(markerOptionsOf(circle.options).figure).toBe('circle');
    expect(markerOptionsOf(star.options).figure).toBe('star');
  });

  it('is hollow as a ring: no fill, an outline of the colour', () => {
    const style = styled(createRingStyle<number>(MARKER_MARK, { color: RED, width: 2 }), POINTS);

    expect(style.fill.color).toBe(0);
    expect(style.stroke).toEqual({ color: RED, size: 2 });
  });

  it('asks for the room between neighbours it was given, a pixel by default', () => {
    expect(createMarkerStyle<number>(MARKER_MARK).elementWidth).toBe(1);
    expect(createMarkerStyle<number>(MARKER_MARK, { spacing: 12 }).elementWidth).toBe(12);
  });

  it('has a closed polygon inside the unit square for every figure but the circle', () => {
    for (const figure of POLYGON_FIGURES) {
      const polygon = FIGURE_POLYGONS[figure];
      expect(polygon.length).toBeGreaterThanOrEqual(3);
      for (const { x, y } of polygon) {
        expect(Math.abs(x)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(y)).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });
});

describe('the candle style', () => {
  it('always draws from candles and names their width and gap for the choice of scale', () => {
    const processor = createCandleStyle<number>(CANDLE_MARK, { width: 8, gap: 2 });

    expect(processor.shape).toBe('candle');
    expect([processor.elementWidth, processor.elementGap]).toEqual([8, 2]);
    expect(candleOptionsOf(styled(processor, CANDLES).marks[0].options).gap).toBe(2);
  });

  it('colours a rising candle and a falling one from the theme', () => {
    const style = styled(createCandleStyle<number>(CANDLE_MARK), CANDLES);

    expect(style.fill.color).toEqual(
      Uint32Array.from([darkTheme.candle.up, darkTheme.candle.down])
    );
    expect(style.stroke.color).toBe(darkTheme.candle.stroke);
  });

  it('refuses a run of points: candles are drawn from candles only', () => {
    expect(() => styled(createCandleStyle<number>(CANDLE_MARK), POINTS)).toThrow(/candle data/);
  });
});

describe('the column style', () => {
  it('names its width and gap for the choice of scale, and stands on the bottom of the plot', () => {
    const processor = createColumnStyle<number>(COLUMN_MARK, { width: 6, gap: 2 });
    const [use] = styled(processor, POINTS).marks;

    expect([processor.elementWidth, processor.elementGap]).toEqual([6, 2]);
    expect(columnOptionsOf(use.options)).toEqual({ baseline: 'bottom', gap: 2 });
  });

  it('reaches to its baseline when the scale is fitted: a histogram always shows nought', () => {
    const run = runOfBatch(POINTS);

    expect(COLUMN_MARK.valueRange(run, 0, 3, { baseline: 0, gap: 0 })).toEqual({ min: 0, max: 30 });
    expect(COLUMN_MARK.valueRange(run, 0, 3, undefined)).toEqual({ min: 10, max: 30 });
  });

  it('measures a candle by its close', () => {
    expect(COLUMN_MARK.valueRange(runOfBatch(CANDLES), 0, 2, undefined)).toEqual({
      min: 9,
      max: 15,
    });
  });
});

describe('the map of shapes and marks', () => {
  it('lets a line, an area and markers be drawn from either shape, candles from candles only', () => {
    expect(LINE_MARK.shapes).toEqual(['point', 'candle']);
    expect(AREA_MARK.shapes).toEqual(['point', 'candle']);
    expect(MARKER_MARK.shapes).toEqual(['point', 'candle']);
    expect(CANDLE_MARK.shapes).toEqual(['candle']);
  });

  it('fits the value axis to a candle by its extremes and skips gaps', () => {
    expect(CANDLE_MARK.valueRange(runOfBatch(CANDLES), 0, 2, undefined)).toEqual({
      min: 5,
      max: 20,
    });
    expect(LINE_MARK.valueRange(runOfBatch(POINTS), 0, 3, undefined)).toEqual({ min: 10, max: 30 });
    expect(LINE_MARK.valueRange(runOfBatch(POINTS), 1, 2, undefined)).toBeUndefined();
  });
});
