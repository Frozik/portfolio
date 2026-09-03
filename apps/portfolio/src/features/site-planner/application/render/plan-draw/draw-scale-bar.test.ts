import { describe, expect, it } from 'vitest';

import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { drawScaleBar } from './draw-scale-bar';
import { callsOf, createRecordingContext } from './recording-context.test-helpers';

function viewportOf(pixelsPerMeter: number): PlanViewport {
  return { centerMeters: { x: 0, y: 0 }, pixelsPerMeter, widthPx: 400, heightPx: 300 };
}

describe('drawScaleBar', () => {
  it('spans the largest round number of metres that fits the target width', () => {
    const { ctx, calls } = createRecordingContext();

    // 140 px target at 10 px/m allows 14 m; the round step below it is 10 m.
    drawScaleBar(ctx, viewportOf(10), { meterUnit: 'м' });

    const [baselineStart] = callsOf(calls, 'moveTo');
    const [baselineEnd] = callsOf(calls, 'lineTo');
    const left = baselineStart.args[0] as number;
    const right = baselineEnd.args[0] as number;

    expect(right - left).toBeCloseTo(100);
    expect(callsOf(calls, 'fillText')[0].args[0]).toBe('10 м');
  });

  it('keeps the precision a sub-metre span needs instead of rounding it away', () => {
    const { ctx, calls } = createRecordingContext();

    // 140 px at 400 px/m allows 0.35 m; the step below is 0.2 m — one decimal.
    drawScaleBar(ctx, viewportOf(400), { meterUnit: 'м' });

    expect(callsOf(calls, 'fillText')[0].args[0]).toBe('0.2 м');
  });

  it('draws nothing without a usable zoom', () => {
    const { ctx, calls } = createRecordingContext();

    drawScaleBar(ctx, viewportOf(0), { meterUnit: 'м' });

    expect(calls).toHaveLength(0);
  });
});
