import { describe, expect, it } from 'vitest';

import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { drawCompass } from './draw-compass';
import { callsOf, createRecordingContext } from './recording-context.test-helpers';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 0, y: 0 },
  pixelsPerMeter: 10,
  widthPx: 400,
  heightPx: 300,
};

/** The needle tip: the first point of the triangle drawn after the ring. */
function needleTip(calls: ReturnType<typeof createRecordingContext>['calls']): {
  readonly x: number;
  readonly y: number;
} {
  const [tip] = callsOf(calls, 'moveTo');

  return { x: tip.args[0] as number, y: tip.args[1] as number };
}

describe('drawCompass', () => {
  it('points the needle straight up while the plan keeps north up', () => {
    const { ctx, calls } = createRecordingContext();

    drawCompass(ctx, VIEWPORT, { northOffsetDegrees: 0, northLabel: 'С' });

    const [ring] = callsOf(calls, 'arc');
    const center = { x: ring.args[0] as number, y: ring.args[1] as number };
    const tip = needleTip(calls);

    expect(tip.x).toBeCloseTo(center.x);
    expect(tip.y).toBeLessThan(center.y);
  });

  it('turns the needle against the plan rotation, so it keeps naming true north', () => {
    const { ctx, calls } = createRecordingContext();

    // The plot turned 90° clockwise on the sheet — north now lies to the left.
    drawCompass(ctx, VIEWPORT, { northOffsetDegrees: 90, northLabel: 'С' });

    const [ring] = callsOf(calls, 'arc');
    const center = { x: ring.args[0] as number, y: ring.args[1] as number };
    const tip = needleTip(calls);

    expect(tip.y).toBeCloseTo(center.y);
    expect(tip.x).toBeLessThan(center.x);
  });

  it('captions the needle with the given label just past the ring', () => {
    const { ctx, calls } = createRecordingContext();

    drawCompass(ctx, VIEWPORT, { northOffsetDegrees: 0, northLabel: 'N' });

    const labels = callsOf(calls, 'fillText');

    expect(labels).toHaveLength(1);
    expect(labels[0].args[0]).toBe('N');
  });
});
