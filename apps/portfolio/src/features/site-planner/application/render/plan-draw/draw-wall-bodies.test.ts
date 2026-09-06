import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildWallBody } from '../../../domain/geometry/wall-geometry';
import type { WallId } from '../../../domain/model/walls';
import { createWall } from '../../../domain/model/walls';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import type { PlanWallBody } from './draw-wall-bodies';
import { drawWallBodies } from './draw-wall-bodies';
import {
  callsOf,
  createRecordingContext,
  stubRecordingPath2D,
} from './recording-context.test-helpers';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 5, y: 5 },
  pixelsPerMeter: 10,
  widthPx: 400,
  heightPx: 300,
};

function bodyOf(points: readonly { readonly x: number; readonly y: number }[]): PlanWallBody {
  const wall = createWall({ points: [...points] });

  return { id: wall.id, material: wall.material, polygons: buildWallBody(wall) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('drawWallBodies', () => {
  it('welds crossing masonry into one body: a single fill however many walls meet', () => {
    const { ctx, calls } = createRecordingContext();

    stubRecordingPath2D(calls);
    // A cross: were these filled one by one, the translucent fills would
    // stack into a dark patch at the junction — the overlap bug.
    drawWallBodies(ctx, VIEWPORT, [
      bodyOf([
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ]),
      bodyOf([
        { x: 5, y: 0 },
        { x: 5, y: 10 },
      ]),
    ]);

    expect(callsOf(calls, 'fill')).toHaveLength(1);
  });

  it('keeps the selected wall answerable: its own outline strokes on top', () => {
    const { ctx, calls } = createRecordingContext();

    stubRecordingPath2D(calls);

    const first = bodyOf([
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ]);

    drawWallBodies(ctx, VIEWPORT, [first], first.id as WallId);

    expect(callsOf(calls, 'stroke').length).toBeGreaterThanOrEqual(2);
  });
});
