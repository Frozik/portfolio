import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { WALL_LINE_WIDTH_PX } from './draw-wall-bodies';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

/**
 * A floor you can stand on, and it has to look like one (R28). The first take
 * was opaque but nearly the colour of the plot behind it, so an overhang still
 * read as a hole — «opaque» is not the same as «legible». This is the tone the
 * house itself is filled with, one step lighter, so the strip beyond the storey
 * below reads as a room over a carport rather than as a gap.
 */
const OVERHANG_FLOOR_FILL = 'rgba(96, 165, 250, 0.14)';

const OVERHANG_FLOOR_BACKDROP = '#0d1016';

const UPPER_OUTLINE_DASH_PX: readonly number[] = [6, 4];

/**
 * The floor of a storey where it reaches past the one below (R28). An overhang
 * is FLOOR — you can stand on it — so it is filled solid: leaving the plot
 * showing through it read as a hole in the building rather than as a room over
 * a carport.
 */
export function drawOverhangFloor(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  overhang: MultiPolygon
): void {
  if (overhang.length === 0) {
    return;
  }

  const path = buildMultiPolygonPath(overhang, viewport);

  ctx.save();
  // Two coats: an opaque one so nothing of the plot shows through the floor,
  // and the house's own tint over it so it reads as part of the building.
  ctx.fillStyle = OVERHANG_FLOOR_BACKDROP;
  ctx.fill(path, 'nonzero');
  ctx.fillStyle = OVERHANG_FLOOR_FILL;
  ctx.fill(path, 'nonzero');
  ctx.strokeStyle = PLAN_COLORS.houseStroke;
  ctx.lineWidth = WALL_LINE_WIDTH_PX;
  ctx.stroke(path);
  ctx.restore();
}

/** Upper storeys read as dashed outlines over the ground plan. */
export function drawUpperFootprints(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  footprints: MultiPolygon
): void {
  if (footprints.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = PLAN_COLORS.houseStroke;
  ctx.lineWidth = WALL_LINE_WIDTH_PX;
  ctx.setLineDash([...UPPER_OUTLINE_DASH_PX]);
  ctx.stroke(buildMultiPolygonPath(footprints, viewport));
  ctx.restore();
}
