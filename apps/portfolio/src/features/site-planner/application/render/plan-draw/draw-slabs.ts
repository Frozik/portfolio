import type { PolygonWithHoles } from '../../../domain/geometry/polygon-types';
import type { ShapeId } from '../../../domain/model/shapes';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

const OUTLINE_LINE_WIDTH_PX = 1.2;
const SELECTED_LINE_WIDTH_PX = 2.4;
const EDGE_DASH_PX: readonly number[] = [7, 5];

/**
 * The floor reads as a surface, not as a room: a flat coat under everything,
 * over the backdrop first so a slab hanging in the air past the storey below
 * is opaque rather than a window onto the plot (R28).
 */
const SLAB_BACKDROP = '#0d1016';
const SLAB_FILL = 'rgba(148, 163, 184, 0.12)';
const SLAB_STROKE = '#7c8798';

/** One floor slab as the plan states it — an outline and its own body. */
export interface PlanSlab {
  readonly id: ShapeId;
  readonly footprint: PolygonWithHoles;
}

/**
 * The slabs of the displayed storey, drawn before anything that stands on
 * them. Their edge is dashed: a slab edge is where the floor stops, not a
 * wall, and drawing it solid made a bare plate read as a room.
 */
export function drawSlabs(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  slabs: readonly PlanSlab[],
  { selectedSlabId }: { readonly selectedSlabId?: ShapeId } = {}
): void {
  if (slabs.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const slab of slabs) {
    const path = buildMultiPolygonPath([slab.footprint], viewport);
    const isSelected = slab.id === selectedSlabId;

    ctx.fillStyle = SLAB_BACKDROP;
    ctx.fill(path, 'nonzero');
    ctx.fillStyle = SLAB_FILL;
    ctx.fill(path, 'nonzero');

    ctx.setLineDash(isSelected ? [] : EDGE_DASH_PX);
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : SLAB_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : OUTLINE_LINE_WIDTH_PX;
    ctx.stroke(path);
  }

  ctx.restore();
}
