import type { Vector2 } from '@frozik/utils/math/vector2';

import { isNil } from 'lodash-es';
import type { SegmentReadout } from '../../../domain/geometry/draw-constraints';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { WALL_LINE_WIDTH_PX } from './draw-wall-bodies';
import { drawLabel, formatMeters, PLAN_COLORS, planMonoFont } from './shared';

const DRAFT_DASH_PATTERN_PX: readonly number[] = [5, 4];

const DRAFT_POINT_RADIUS_PX = 2.5;

/** The readout rides above the cursor so the pointer never covers it. */
const DRAFT_READOUT_OFFSET_PX = 18;

const DRAFT_READOUT_DECIMALS = 2;

const FULL_CIRCLE_RADIANS = 2 * Math.PI;

/** The polyline of a wall being clicked out, dashed until it is committed. */
export function drawWallDraft(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  points: readonly Vector2[],
  {
    cursor,
    readout,
    meterUnit,
  }: {
    /** Where the next corner would land — the rubber band's far end. */
    readonly cursor?: Vector2;
    readonly readout?: SegmentReadout;
    readonly meterUnit: string;
  }
): void {
  if (points.length === 0) {
    return;
  }

  // The band to the cursor is the segment a click would commit, so it is drawn
  // from the same point the commit uses: aiming and building agree by
  // construction, which is what lets the readout below be trusted.
  const banded = isNil(cursor) ? points : [...points, cursor];
  const screenPoints = banded.map(point => planToScreen(viewport, point));

  ctx.save();
  ctx.strokeStyle = PLAN_COLORS.selectionStroke;
  ctx.fillStyle = PLAN_COLORS.selectionStroke;
  ctx.lineWidth = WALL_LINE_WIDTH_PX;
  ctx.setLineDash([...DRAFT_DASH_PATTERN_PX]);
  ctx.beginPath();

  screenPoints.forEach((screenPoint, index) => {
    if (index === 0) {
      ctx.moveTo(screenPoint.x, screenPoint.y);
    } else {
      ctx.lineTo(screenPoint.x, screenPoint.y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);

  for (const screenPoint of screenPoints) {
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, DRAFT_POINT_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.fill();
  }

  ctx.restore();

  if (isNil(cursor) || isNil(readout)) {
    return;
  }

  const anchor = planToScreen(viewport, cursor);

  drawLabel(
    ctx,
    `${formatMeters(readout.lengthMeters, meterUnit, DRAFT_READOUT_DECIMALS)} · ${readout.angleDegrees.toFixed(0)}°`,
    { x: anchor.x, y: anchor.y - DRAFT_READOUT_OFFSET_PX }
  );
}

const JUNCTION_RING_RADIUS_PX = 6;

const BADGE_DISTANCE_PX = 26;

const BADGE_RADIUS_PX = 8;

const BADGE_FILL = 'rgba(13, 16, 22, 0.9)';

const BADGE_FONT_PX = 10;

/**
 * The break UI over a selected wall junction: an accent ring on the node and a
 * numbered badge a hand's reach out along every incident edge — the numbers
 * the digit/D keys answer to.
 */
export function drawJunctionBadges(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  junction: {
    readonly position: Vector2;
    readonly edges: readonly { readonly farPoint: Vector2 }[];
  }
): void {
  const center = planToScreen(viewport, junction.position);

  ctx.save();
  ctx.strokeStyle = PLAN_COLORS.selectionStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, JUNCTION_RING_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.stroke();

  junction.edges.forEach((edge, index) => {
    const far = planToScreen(viewport, edge.farPoint);
    const length = Math.hypot(far.x - center.x, far.y - center.y);

    if (length === 0) {
      return;
    }

    const reach = Math.min(BADGE_DISTANCE_PX, length / 2);
    const x = center.x + ((far.x - center.x) / length) * reach;
    const y = center.y + ((far.y - center.y) / length) * reach;

    ctx.fillStyle = BADGE_FILL;
    ctx.beginPath();
    ctx.arc(x, y, BADGE_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.fill();
    ctx.strokeStyle = PLAN_COLORS.selectionStroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = PLAN_COLORS.textStrong;
    ctx.font = planMonoFont(BADGE_FONT_PX);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x, y);
  });

  ctx.restore();
}
