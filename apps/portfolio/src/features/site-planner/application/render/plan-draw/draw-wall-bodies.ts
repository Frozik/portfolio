import { isNil } from 'lodash-es';
import { unionPolygons } from '../../../domain/geometry/polygon-booleans';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { WallId, WallMaterial } from '../../../domain/model/walls';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

export const WALL_LINE_WIDTH_PX = 1.2;

export const SELECTED_LINE_WIDTH_PX = 2.4;

/** Masonry reads as solid; glazing as barely-there sheet. */
const WALL_FILL = 'rgba(148, 163, 184, 0.55)';

const GLAZING_FILL = 'rgba(148, 197, 250, 0.18)';

const WALL_STROKE = '#94a3b8';

/** One wall as the drawing needs it: its derived body, named by id for the accent. */
export interface PlanWallBody {
  readonly id: WallId;
  readonly material: WallMaterial;
  readonly polygons: MultiPolygon;
}

/**
 * The walls of one building over its footprint. Masonry is drawn as ONE
 * WELDED BODY — the union of every non-glazing wall — the way built walls
 * actually meet: body by body, the translucent fills stacked into dark
 * patches at every junction and each wall's outline ran straight through its
 * neighbour. Glazing keeps its own translucent sheet per wall, and the
 * selected wall answers with an accent outline of its own body on top.
 */
export function drawWallBodies(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  walls: readonly PlanWallBody[],
  selectedWallId?: WallId
): void {
  if (walls.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  const masonry = unionPolygons(
    walls.filter(wall => wall.material !== 'glazing').map(wall => wall.polygons)
  );

  if (masonry.length > 0) {
    const path = buildMultiPolygonPath(masonry, viewport);

    ctx.fillStyle = WALL_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = WALL_STROKE;
    ctx.lineWidth = WALL_LINE_WIDTH_PX;
    ctx.stroke(path);
  }

  for (const wall of walls) {
    if (wall.material !== 'glazing' || wall.polygons.length === 0) {
      continue;
    }

    const path = buildMultiPolygonPath(wall.polygons, viewport);

    ctx.fillStyle = GLAZING_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = WALL_STROKE;
    ctx.lineWidth = WALL_LINE_WIDTH_PX;
    ctx.stroke(path);
  }

  const selected = walls.find(wall => wall.id === selectedWallId);

  if (!isNil(selected) && selected.polygons.length > 0) {
    ctx.strokeStyle = PLAN_COLORS.selectionStroke;
    ctx.lineWidth = SELECTED_LINE_WIDTH_PX;
    ctx.stroke(buildMultiPolygonPath(selected.polygons, viewport));
  }

  ctx.restore();
}
