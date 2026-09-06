import type { Vector2 } from '@frozik/utils/math/vector2';

import { chooseContourLabels } from '../../../domain/terrain/contour-labels';
import type { ContourPolyline } from '../../../domain/terrain/contour-types';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { drawLabel, formatMeters, PLAN_COLORS } from './shared';

const CONTOUR_LINE_WIDTH_PX = 1;

export interface ContourStyle {
  readonly strokeColor: string;
  readonly textColor: string;
}

const DEFAULT_CONTOUR_STYLE: ContourStyle = {
  strokeColor: PLAN_COLORS.contourStroke,
  textColor: PLAN_COLORS.text,
};

/**
 * The interpolated terrain, drawn as thin lines of equal elevation with one
 * caption per level. Hairlines on purpose: the contours are the background the
 * plot and its objects are read against, never the subject.
 *
 * The terrain is sampled over the plot's bounding box while the plot fills only
 * part of it, so the lines are cut back to the plot: a contour running on past
 * the boundary would draw ground nobody surveyed and nobody owns. The captions
 * are placed inside the plot rather than left to the clip — a number sliced in
 * half by the boundary is worse than no number at all.
 */
export function drawContours(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    contours,
    meterUnit,
    plotClipPath,
  }: {
    readonly contours: readonly ContourPolyline[];
    readonly meterUnit: string;
    /** The plot's boundary in screen space, as `buildMultiPolygonPath` builds it. */
    readonly plotClipPath: Path2D;
  },
  style: ContourStyle = DEFAULT_CONTOUR_STYLE
): void {
  if (contours.length === 0) {
    return;
  }

  const isInsidePlot = (position: Vector2): boolean => {
    const screenPoint = planToScreen(viewport, position);

    return ctx.isPointInPath(plotClipPath, screenPoint.x, screenPoint.y);
  };

  ctx.save();
  ctx.clip(plotClipPath);
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = CONTOUR_LINE_WIDTH_PX;
  ctx.beginPath();

  for (const contour of contours) {
    contour.points.forEach((point, index) => {
      const screenPoint = planToScreen(viewport, point);

      if (index === 0) {
        ctx.moveTo(screenPoint.x, screenPoint.y);
      } else {
        ctx.lineTo(screenPoint.x, screenPoint.y);
      }
    });
  }

  ctx.stroke();
  ctx.restore();

  for (const label of chooseContourLabels(contours, isInsidePlot)) {
    drawLabel(
      ctx,
      formatMeters(label.level, meterUnit),
      planToScreen(viewport, label.position),
      style.textColor
    );
  }
}
