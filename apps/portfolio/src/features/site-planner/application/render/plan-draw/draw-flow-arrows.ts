import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { Heightfield } from '../../../domain/terrain/heightfield';
import { samplePosition } from '../../../domain/terrain/heightfield';
import { computeFlowDirection } from '../../../domain/terrain/slope';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planDirectionToScreen, planToScreen } from '../../../domain/view/plan-viewport';
import { PLAN_COLORS } from './shared';

/** The sampled ground and the part of it the plot covers. */
export interface FlowField {
  readonly field: Heightfield;
  /** 1 where the plot covers the sample, 0 beyond its boundary. */
  readonly coverage: Float32Array;
}

/** A sample the plot does not reach carries no arrow. */
const UNCOVERED = 0;

/**
 * How far apart the arrows are meant to stand on screen. The lattice is thinned
 * to the nearest whole number of cells that reaches it, so zooming in adds
 * arrows and zooming out drops them while the drawing stays equally dense.
 */
const ARROW_SPACING_PX = 34;

const ARROW_LENGTH_PX = 11;
const ARROW_HEAD_PX = 4;
const ARROW_LINE_WIDTH_PX = 1;
/** How far the barbs of the head open away from the shaft. */
const ARROW_HEAD_SPREAD = 0.55;

const HALF = 0.5;

export interface FlowArrowStyle {
  readonly strokeColor: string;
}

const DEFAULT_FLOW_ARROW_STYLE: FlowArrowStyle = {
  strokeColor: PLAN_COLORS.flowArrowStroke,
};

/**
 * Which way water runs off the plot, as a sparse lattice of arrows over the
 * slope colours: the colours say how steep the ground is, the arrows say where
 * what falls on it ends up — the second half of a runoff reading, and the half
 * a colour ramp cannot carry.
 */
export function drawFlowArrows(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  { field, coverage }: FlowField,
  style: FlowArrowStyle = DEFAULT_FLOW_ARROW_STYLE
): void {
  const { resolution, cellSizeMeters } = field;
  const cellSizePx = cellSizeMeters * viewport.pixelsPerMeter;

  if (!(cellSizePx > 0)) {
    return;
  }

  const stepTexels = Math.max(1, Math.round(ARROW_SPACING_PX / cellSizePx));
  // Half a step in from the edge, so the lattice sits inside the plot rather
  // than starting on its southern and western borders.
  const firstIndex = Math.floor(stepTexels * HALF);

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = ARROW_LINE_WIDTH_PX;
  ctx.beginPath();

  for (let row = firstIndex; row < resolution; row += stepTexels) {
    for (let column = firstIndex; column < resolution; column += stepTexels) {
      if (coverage[row * resolution + column] === UNCOVERED) {
        continue;
      }

      const flowDirection = computeFlowDirection(field, column, row);

      if (isNil(flowDirection)) {
        continue;
      }

      const screenDirection = planDirectionToScreen({
        x: flowDirection.columnStep,
        y: flowDirection.rowStep,
      });

      if (isNil(screenDirection)) {
        continue;
      }

      appendArrow(ctx, planToScreen(viewport, samplePosition(field, column, row)), screenDirection);
    }
  }

  ctx.stroke();
  ctx.restore();
}

/** One arrow centred on the sample, pointing the way the water leaves it. */
function appendArrow(ctx: CanvasRenderingContext2D, center: Vector2, direction: Vector2): void {
  const tail: Vector2 = {
    x: center.x - direction.x * ARROW_LENGTH_PX * HALF,
    y: center.y - direction.y * ARROW_LENGTH_PX * HALF,
  };
  const head: Vector2 = {
    x: center.x + direction.x * ARROW_LENGTH_PX * HALF,
    y: center.y + direction.y * ARROW_LENGTH_PX * HALF,
  };
  const sideways: Vector2 = { x: -direction.y, y: direction.x };

  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);

  for (const side of [1, -1]) {
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(
      head.x - direction.x * ARROW_HEAD_PX + sideways.x * side * ARROW_HEAD_PX * ARROW_HEAD_SPREAD,
      head.y - direction.y * ARROW_HEAD_PX + sideways.y * side * ARROW_HEAD_PX * ARROW_HEAD_SPREAD
    );
  }
}
