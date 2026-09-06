import type { Vector2 } from '@frozik/utils/math/vector2';

import type { TreeId, TreeInstance } from '../../../domain/model/plot-objects';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { PLAN_COLORS } from './shared';

const CROWN_LINE_WIDTH_PX = 1.4;
const SELECTED_LINE_WIDTH_PX = 2.2;
/** The trunk: the point the tree is actually planted at, under the crown. */
const TRUNK_DOT_RADIUS_PX = 2;
/** A crown drawn smaller than this at the current zoom would be a dot with a ring. */
const MIN_CROWN_RADIUS_PX = 3;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

export interface TreeStyle {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly selectedColor: string;
}

const DEFAULT_TREE_STYLE: TreeStyle = {
  fillColor: PLAN_COLORS.treeFill,
  strokeColor: PLAN_COLORS.treeStroke,
  selectedColor: PLAN_COLORS.selectionStroke,
};

/**
 * Trees, drawn the way a planting plan draws them: the crown as a circle of its
 * real radius, so the spread of a mature tree can be read against the plot and
 * against the house, with the trunk marked at its centre.
 */
export function drawTrees(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    trees,
    selectedTreeId,
  }: {
    readonly trees: readonly TreeInstance[];
    readonly selectedTreeId: TreeId | undefined;
  },
  style: TreeStyle = DEFAULT_TREE_STYLE
): void {
  if (trees.length === 0) {
    return;
  }

  ctx.save();

  for (const tree of trees) {
    const screenPoint = planToScreen(viewport, tree.position);
    const isSelected = tree.id === selectedTreeId;
    const radiusPx = Math.max(tree.crownRadius * viewport.pixelsPerMeter, MIN_CROWN_RADIUS_PX);

    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, radiusPx, 0, FULL_CIRCLE_RADIANS);
    ctx.fillStyle = style.fillColor;
    ctx.fill();
    ctx.strokeStyle = isSelected ? style.selectedColor : style.strokeColor;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : CROWN_LINE_WIDTH_PX;
    ctx.stroke();

    drawTrunk(ctx, screenPoint, isSelected ? style.selectedColor : style.strokeColor);
  }

  ctx.restore();
}

function drawTrunk(ctx: CanvasRenderingContext2D, screenPoint: Vector2, color: string): void {
  ctx.beginPath();
  ctx.arc(screenPoint.x, screenPoint.y, TRUNK_DOT_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.fillStyle = color;
  ctx.fill();
}
