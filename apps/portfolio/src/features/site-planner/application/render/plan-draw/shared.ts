import type { Vector2 } from '@frozik/utils/math/vector2';

import type { MultiPolygon, Ring } from '../../../domain/geometry/polygon-types';
import type { Meters } from '../../../domain/units';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';

/**
 * The plan speaks the landing page's dark palette (`--color-landing-*` in
 * `styles/tailwind.css`). The values are duplicated as literals because the
 * drawing modules render off-DOM with no access to the CSS cascade — keeping
 * them in this one object is what stops the two from drifting apart.
 */
/**
 * Everything an open editor is NOT editing steps back to this opacity —
 * present as context, visibly out of reach (see modes.md).
 */
export const EDIT_DIM_ALPHA = 0.35;

export const PLAN_COLORS = {
  background: '#07090c',
  gridMinor: 'rgba(255, 255, 255, 0.035)',
  gridMajor: 'rgba(255, 255, 255, 0.09)',
  boundaryFill: 'rgba(96, 165, 250, 0.1)',
  boundaryStroke: '#60a5fa',
  houseFill: 'rgba(96, 165, 250, 0.16)',
  houseStroke: '#60a5fa',
  setbackStroke: 'rgba(96, 165, 250, 0.45)',
  selectionStroke: '#e7ecf3',
  handleFill: '#0d1016',
  handleStroke: '#e7ecf3',
  dimensionStroke: 'rgba(231, 236, 243, 0.55)',
  contourStroke: 'rgba(118, 129, 154, 0.55)',
  treeFill: 'rgba(76, 217, 100, 0.12)',
  treeStroke: '#4cd964',
  /** A parked car is machinery on a green plan, so it reads as neutral metal. */
  carFill: 'rgba(148, 163, 184, 0.22)',
  carStroke: '#94a3b8',
  pathFill: 'rgba(118, 129, 154, 0.28)',
  /** Dirt paving: the warm earth against the asphalt's cool grey (`pathFill`). */
  pathDirtFill: 'rgba(155, 122, 76, 0.32)',
  pathStroke: 'rgba(118, 129, 154, 0.75)',
  markFill: '#f5c842',
  measureStroke: '#f5c842',
  /** Runoff arrows read as ink over the slope colours, never as another colour. */
  flowArrowStroke: 'rgba(7, 9, 12, 0.8)',
  chromeStroke: 'rgba(162, 173, 189, 0.75)',
  /** Skeletons are there to aim at, so they stay quieter than what they outline. */
  skeletonStroke: 'rgba(162, 173, 189, 0.45)',
  snapIndicatorStroke: '#f5c842',
  /**
   * Advisory findings — a stair too steep, an overhang without a post, a
   * cupboard over a stairwell. Amber warns without forbidding: the plan is
   * the user's, and the editor only names the norm it broke.
   */
  warningStroke: '#f5a524',
  warningFill: 'rgba(245, 165, 36, 0.16)',
  text: '#a2adbd',
  textStrong: '#e7ecf3',
  labelBackdrop: 'rgba(7, 9, 12, 0.75)',
} as const;

/** Mirrors `--font-mono`: readouts line up digit for digit while dragging. */
const PLAN_MONO_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const PLAN_LABEL_FONT_SIZE_PX = 11;

export function planMonoFont(fontSizePx: number): string {
  return `${fontSizePx}px ${PLAN_MONO_FONT_FAMILY}`;
}

/** Distance from the canvas edge to the compass / scale-bar stack. */
export const PLAN_CHROME_PADDING_PX = 16;
export const PLAN_CHROME_ROW_GAP_PX = 10;
export const COMPASS_RADIUS_PX = 16;
export const SCALE_BAR_TICK_HEIGHT_PX = 8;
export const SCALE_BAR_LABEL_GAP_PX = 4;
/** Height of the whole scale-bar block; the compass stacks on top of it. */
export const SCALE_BAR_BLOCK_HEIGHT_PX =
  SCALE_BAR_TICK_HEIGHT_PX + SCALE_BAR_LABEL_GAP_PX + PLAN_LABEL_FONT_SIZE_PX;

const DEFAULT_METER_FRACTION_DIGITS = 2;

const LABEL_PADDING_X_PX = 4;
const LABEL_PADDING_Y_PX = 2;

export function buildRingPath(ring: Ring, viewport: PlanViewport): Path2D {
  const path = new Path2D();

  appendRing(path, ring, viewport);

  return path;
}

/**
 * One `Path2D` for the whole multipolygon: holes are appended as their own
 * sub-paths, and the winding convention of {@link Ring} makes the non-zero fill
 * rule punch them out while islands nested inside a hole fill again.
 */
export function buildMultiPolygonPath(polygons: MultiPolygon, viewport: PlanViewport): Path2D {
  const path = new Path2D();

  for (const polygon of polygons) {
    appendRing(path, polygon.outer, viewport);

    for (const hole of polygon.holes) {
      appendRing(path, hole, viewport);
    }
  }

  return path;
}

export function formatMeters(
  value: Meters,
  meterUnit: string,
  fractionDigits: number = DEFAULT_METER_FRACTION_DIGITS
): string {
  return `${value.toFixed(fractionDigits)} ${meterUnit}`;
}

/** Earthworks are quoted to a tenth of a cubic metre; below that it is noise. */
const VOLUME_FRACTION_DIGITS = 1;

/** A soil volume, as both the house panel and the overlay legend report it. */
export function formatCubicMeters(value: number, cubicMeterUnit: string): string {
  return `${value.toFixed(VOLUME_FRACTION_DIGITS)} ${cubicMeterUnit}`;
}

/**
 * Centred readout with a backdrop, so a dimension or a distance stays legible
 * over the grid and over the boundary fill alike.
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  screenPoint: Vector2,
  color: string = PLAN_COLORS.textStrong
): void {
  ctx.save();
  ctx.font = planMonoFont(PLAN_LABEL_FONT_SIZE_PX);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const width = ctx.measureText(text).width;
  const boxWidth = width + 2 * LABEL_PADDING_X_PX;
  const boxHeight = PLAN_LABEL_FONT_SIZE_PX + 2 * LABEL_PADDING_Y_PX;

  ctx.fillStyle = PLAN_COLORS.labelBackdrop;
  ctx.fillRect(screenPoint.x - boxWidth / 2, screenPoint.y - boxHeight / 2, boxWidth, boxHeight);

  ctx.fillStyle = color;
  ctx.fillText(text, screenPoint.x, screenPoint.y);
  ctx.restore();
}

function appendRing(path: Path2D, ring: Ring, viewport: PlanViewport): void {
  if (ring.length === 0) {
    return;
  }

  ring.forEach((point, index) => {
    const screenPoint = planToScreen(viewport, point);

    if (index === 0) {
      path.moveTo(screenPoint.x, screenPoint.y);
    } else {
      path.lineTo(screenPoint.x, screenPoint.y);
    }
  });

  path.closePath();
}
