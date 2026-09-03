import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import {
  callsOf,
  createRecordingContext,
  stubRecordingPath2D,
} from './recording-context.test-helpers';
import { buildMultiPolygonPath, drawLabel, formatMeters, PLAN_COLORS } from './shared';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 0, y: 0 },
  pixelsPerMeter: 10,
  widthPx: 200,
  heightPx: 100,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatMeters', () => {
  it('renders two decimals and the given unit by default', () => {
    expect(formatMeters(12.5, 'm')).toBe('12.50 m');
  });

  it('honours an explicit precision', () => {
    expect(formatMeters(10, 'm', 0)).toBe('10 m');
    expect(formatMeters(0.5, 'm', 1)).toBe('0.5 m');
  });
});

describe('buildMultiPolygonPath', () => {
  it('closes the outer ring and every hole as its own sub-path', () => {
    const { calls } = createRecordingContext();
    stubRecordingPath2D(calls);

    const polygons: MultiPolygon = [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
        ],
        holes: [
          [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 2, y: 2 },
          ],
        ],
      },
    ];

    buildMultiPolygonPath(polygons, VIEWPORT);

    // One moveTo opens each ring; each ring is explicitly closed.
    expect(callsOf(calls, 'moveTo')).toHaveLength(2);
    expect(callsOf(calls, 'lineTo')).toHaveLength(4);
    expect(callsOf(calls, 'closePath')).toHaveLength(2);
  });

  it('opens no sub-path for an empty ring', () => {
    const { calls } = createRecordingContext();
    stubRecordingPath2D(calls);

    buildMultiPolygonPath([{ outer: [], holes: [] }], VIEWPORT);

    expect(callsOf(calls, 'moveTo')).toHaveLength(0);
  });
});

describe('drawLabel', () => {
  it('backs the text with a backdrop centred on the same point', () => {
    const { ctx, calls } = createRecordingContext();

    drawLabel(ctx, '12.50 m', { x: 100, y: 40 });

    const [backdrop] = callsOf(calls, 'fillRect');
    const [text] = callsOf(calls, 'fillText');
    const backdropCenterX = (backdrop.args[0] as number) + (backdrop.args[2] as number) / 2;
    const backdropCenterY = (backdrop.args[1] as number) + (backdrop.args[3] as number) / 2;

    expect(backdropCenterX).toBeCloseTo(100);
    expect(backdropCenterY).toBeCloseTo(40);
    expect(text.args).toEqual(['12.50 m', 100, 40]);
    // The backdrop is painted first, in the backdrop colour, so it sits under.
    expect(calls.indexOf(backdrop)).toBeLessThan(calls.indexOf(text));
  });

  it('reads out in the strong text colour unless told otherwise', () => {
    const { ctx, calls } = createRecordingContext();

    drawLabel(ctx, 'x', { x: 0, y: 0 });

    const fillStyles = calls
      .filter(call => call.method === 'set:fillStyle')
      .map(call => call.args[0]);

    expect(fillStyles).toEqual([PLAN_COLORS.labelBackdrop, PLAN_COLORS.textStrong]);
  });
});
