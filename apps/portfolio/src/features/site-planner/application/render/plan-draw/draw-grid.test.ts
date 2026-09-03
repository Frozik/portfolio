import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { drawGrid } from './draw-grid';
import {
  callsOf,
  createRecordingContext,
  stubRecordingPath2D,
  valuesSet,
} from './recording-context.test-helpers';
import { PLAN_COLORS } from './shared';

function viewportOf(pixelsPerMeter: number): PlanViewport {
  return { centerMeters: { x: 0, y: 0 }, pixelsPerMeter, widthPx: 200, heightPx: 100 };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('drawGrid', () => {
  it('keeps minor lines a readable distance apart whatever the zoom', () => {
    const { ctx, calls } = createRecordingContext();
    stubRecordingPath2D(calls);

    // At 10 px/m a 1 m grid would sit 10 px apart — too dense to read, so the
    // spacing climbs to the next 1/2/5 step whose lines stay ≥ 14 px apart.
    drawGrid(ctx, viewportOf(10), { baseStepMeters: 1 });

    const verticalStarts = callsOf(calls, 'moveTo', 'path#1')
      .filter(call => call.args[1] === 0)
      .map(call => call.args[0] as number)
      .sort((left, right) => left - right);

    expect(verticalStarts.length).toBeGreaterThan(1);

    for (let index = 1; index < verticalStarts.length; index += 1) {
      expect(verticalStarts[index] - verticalStarts[index - 1]).toBeCloseTo(20);
    }
  });

  it('respects a coarser configured step instead of densifying past it', () => {
    const { ctx, calls } = createRecordingContext();
    stubRecordingPath2D(calls);

    drawGrid(ctx, viewportOf(10), { baseStepMeters: 5 });

    const verticalStarts = callsOf(calls, 'moveTo', 'path#1')
      .filter(call => call.args[1] === 0)
      .map(call => call.args[0] as number)
      .sort((left, right) => left - right);

    for (let index = 1; index < verticalStarts.length; index += 1) {
      expect(verticalStarts[index] - verticalStarts[index - 1]).toBeCloseTo(50);
    }
  });

  it('emphasises every fifth line with the major colour over the minor pass', () => {
    const { ctx, calls } = createRecordingContext();
    stubRecordingPath2D(calls);

    drawGrid(ctx, viewportOf(10), { baseStepMeters: 1 });

    expect(valuesSet(calls, 'strokeStyle')).toEqual([PLAN_COLORS.gridMinor, PLAN_COLORS.gridMajor]);
    // Major spacing is five minors: 5 × 2 m × 10 px/m = 100 px on a 200 px sheet.
    const majorVerticals = callsOf(calls, 'moveTo', 'path#2').filter(call => call.args[1] === 0);

    expect(majorVerticals).toHaveLength(3);
  });

  it('draws nothing over a degenerate viewport', () => {
    const { ctx, calls } = createRecordingContext();
    stubRecordingPath2D(calls);

    drawGrid(ctx, { ...viewportOf(10), widthPx: 0 }, { baseStepMeters: 1 });
    drawGrid(ctx, viewportOf(0), { baseStepMeters: 1 });

    expect(calls).toHaveLength(0);
  });
});
