import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { PathRibbon } from '../../../domain/geometry/path-ribbon';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { PathId, PathSurface, SitePath } from '../../../domain/model/plot-objects';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import type { SelectionStyle } from './draw-selection';
import { DEFAULT_SELECTION_STYLE } from './draw-selection';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

const PATH_LINE_WIDTH_PX = 1.2;
const SELECTED_LINE_WIDTH_PX = 2;
const DRAFT_DASH_PATTERN_PX: readonly number[] = [5, 4];
/** The clicked points of a polyline under construction. */
const DRAFT_POINT_RADIUS_PX = 2.5;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

/**
 * A polyline being clicked out, with the ribbon it would become. Both are given
 * rather than derived here: widening a polyline is a boolean-offset operation,
 * and the drawing modules stay free of geometry the store already computes.
 */
export interface PathDraft {
  /** Placed points followed by the cursor, so the last segment tracks the pointer. */
  readonly points: readonly Vector2[];
  readonly ribbon: MultiPolygon;
}

export interface PathStyle {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly selectedColor: string;
}

const DEFAULT_PATH_STYLE: PathStyle = {
  fillColor: PLAN_COLORS.pathFill,
  strokeColor: PLAN_COLORS.pathStroke,
  selectedColor: PLAN_COLORS.selectionStroke,
};

/** The one place a paving maps to its fill — pieces and gradient stops alike. */
function surfaceFill(surface: PathSurface, style: PathStyle): string {
  return surface === 'dirt' ? PLAN_COLORS.pathDirtFill : style.fillColor;
}

/**
 * Paths as the paving they stand for: each ribbon filled and outlined, and the
 * one being clicked out shown the same way with its polyline dashed over it — so
 * what the next click adds is visible before it is committed.
 */
export function drawPaths(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    ribbons,
    selectedPathId,
    draft,
  }: {
    readonly ribbons: readonly PathRibbon[];
    readonly selectedPathId: PathId | undefined;
    readonly draft: PathDraft | undefined;
  },
  style: PathStyle = DEFAULT_PATH_STYLE
): void {
  if (ribbons.length === 0 && isNil(draft)) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const ribbon of ribbons) {
    for (const piece of ribbon.pieces) {
      ctx.fillStyle = surfaceFill(piece.surface, style);
      ctx.fill(buildMultiPolygonPath(piece.polygons, viewport), 'nonzero');
    }

    // The seams fade one paving into the next: each strip is filled with a
    // gradient along the centreline, its ends matching the flat fills beside
    // it — the pieces already stepped out of the strips, so nothing stacks.
    for (const blend of ribbon.seamBlends) {
      const start = planToScreen(viewport, blend.start);
      const end = planToScreen(viewport, blend.end);
      const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);

      gradient.addColorStop(0, surfaceFill(blend.fromSurface, style));
      gradient.addColorStop(1, surfaceFill(blend.toSurface, style));
      ctx.fillStyle = gradient;
      ctx.fill(buildMultiPolygonPath(blend.polygons, viewport), 'nonzero');
    }

    ctx.strokeStyle = ribbon.id === selectedPathId ? style.selectedColor : style.strokeColor;
    ctx.lineWidth = ribbon.id === selectedPathId ? SELECTED_LINE_WIDTH_PX : PATH_LINE_WIDTH_PX;
    ctx.stroke(buildMultiPolygonPath(ribbon.polygons, viewport));
  }

  if (!isNil(draft)) {
    drawDraft(ctx, viewport, draft, style);
  }

  ctx.restore();
}

/**
 * The manipulators of a selected path: a square on every point of the polyline
 * to drag it by, and a smaller ring in the middle of every segment that plants
 * a new point when taken hold of. Vertex handles are listed first so a pick
 * over a short segment prefers the point to the ring between the points.
 */
export interface PathPointHandle {
  readonly kind: 'vertex' | 'midpoint';
  /** Point index for a vertex; index of the segment's first point for a midpoint. */
  readonly index: number;
  readonly screenPoint: Vector2;
}

const VERTEX_HANDLE_SIZE_PX = 8;
const MIDPOINT_HANDLE_RADIUS_PX = 3;
const SEGMENT_MIDDLE = 0.5;

/**
 * A segment shorter than this on screen gets no midpoint ring: squeezed between
 * its two squares, the ring is unreadable and a click there is a coin toss over
 * which of the three the pointer takes.
 */
const MIN_MIDPOINT_SEGMENT_PX = 30;

/** How a handle answers the pointer: passed over, or held and being dragged. */
export interface PathHandleHighlight {
  readonly kind: 'vertex' | 'midpoint';
  readonly index: number;
  readonly state: 'hover' | 'drag';
}

const HOVER_SCALE = 1.25;
const DRAG_SCALE = 1.4;

/**
 * View mode only moves points, so it asks for the squares alone; an open
 * polyline editor adds the rings. One flag keeps the hit test and the drawing
 * agreeing about which handles exist right now. Positions rather than a path:
 * a utility trench's bends and a wall's corners take the same manipulators —
 * a CLOSED polyline (a wall ring) adds the closing segment's midpoint, indexed
 * by the last point so an insert there simply appends.
 */
export function computePolylinePointHandles(
  positions: readonly Vector2[],
  viewport: PlanViewport,
  {
    includeMidpoints,
    isClosed = false,
  }: { readonly includeMidpoints: boolean; readonly isClosed?: boolean }
): readonly PathPointHandle[] {
  const vertices: PathPointHandle[] = positions.map((position, index) => ({
    kind: 'vertex',
    index,
    screenPoint: planToScreen(viewport, position),
  }));

  if (!includeMidpoints) {
    return vertices;
  }

  const segmentCount = isClosed ? positions.length : positions.length - 1;
  const midpoints: PathPointHandle[] = positions
    .slice(0, segmentCount)
    .flatMap((position, index) => {
      const next = positions[(index + 1) % positions.length];
      const screenPoint = planToScreen(viewport, position);
      const nextScreenPoint = planToScreen(viewport, next);

      if (
        Math.hypot(nextScreenPoint.x - screenPoint.x, nextScreenPoint.y - screenPoint.y) <
        MIN_MIDPOINT_SEGMENT_PX
      ) {
        return [];
      }

      return [
        {
          kind: 'midpoint' as const,
          index,
          screenPoint: planToScreen(viewport, {
            x: position.x + (next.x - position.x) * SEGMENT_MIDDLE,
            y: position.y + (next.y - position.y) * SEGMENT_MIDDLE,
          }),
        },
      ];
    });

  return [...vertices, ...midpoints];
}

export function computePathPointHandles(
  path: SitePath,
  viewport: PlanViewport,
  options: { readonly includeMidpoints: boolean }
): readonly PathPointHandle[] {
  return computePolylinePointHandles(
    path.points.map(point => point.position),
    viewport,
    options
  );
}

export function findPathPointHandleAt(
  handles: readonly PathPointHandle[],
  screenPoint: Vector2,
  hitRadiusPx: number
): PathPointHandle | undefined {
  return handles.find(
    handle =>
      Math.hypot(handle.screenPoint.x - screenPoint.x, handle.screenPoint.y - screenPoint.y) <=
      hitRadiusPx
  );
}

export function drawPathPointHandles(
  ctx: CanvasRenderingContext2D,
  handles: readonly PathPointHandle[],
  highlight: PathHandleHighlight | undefined,
  selectedPointIndex: number | undefined,
  style: SelectionStyle = DEFAULT_SELECTION_STYLE
): void {
  ctx.save();

  for (const handle of handles) {
    const { x, y } = handle.screenPoint;
    const state =
      highlight?.kind === handle.kind && highlight.index === handle.index
        ? highlight.state
        : undefined;
    const isSelected = handle.kind === 'vertex' && handle.index === selectedPointIndex;

    // Untouched wears the sheet's dark fill; hovered answers in the plan's
    // accent; held inverts to the light fill so the grabbed handle is
    // unmistakably the one following the pointer. The selected point keeps the
    // accent even while the pointer is elsewhere — its width is on the panel.
    ctx.fillStyle =
      state === 'drag'
        ? style.handleStrokeColor
        : state === 'hover' || isSelected
          ? PLAN_COLORS.boundaryStroke
          : style.handleFillColor;
    ctx.strokeStyle = state === 'drag' ? PLAN_COLORS.boundaryStroke : style.handleStrokeColor;

    const scale = state === 'drag' ? DRAG_SCALE : state === 'hover' ? HOVER_SCALE : 1;

    if (handle.kind === 'vertex') {
      const half = (VERTEX_HANDLE_SIZE_PX * scale) / 2;

      ctx.fillRect(x - half, y - half, half * 2, half * 2);
      ctx.strokeRect(x - half, y - half, half * 2, half * 2);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, MIDPOINT_HANDLE_RADIUS_PX * scale, 0, FULL_CIRCLE_RADIANS);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function fillRibbon(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  polygons: MultiPolygon,
  style: PathStyle
): void {
  if (polygons.length === 0) {
    return;
  }

  ctx.fillStyle = style.fillColor;
  ctx.fill(buildMultiPolygonPath(polygons, viewport), 'nonzero');
}

function drawDraft(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  draft: PathDraft,
  style: PathStyle
): void {
  fillRibbon(ctx, viewport, draft.ribbon, style);

  const screenPoints = draft.points.map(point => planToScreen(viewport, point));

  ctx.strokeStyle = style.selectedColor;
  ctx.fillStyle = style.selectedColor;
  ctx.lineWidth = PATH_LINE_WIDTH_PX;
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
    drawDraftPoint(ctx, screenPoint);
  }
}

function drawDraftPoint(ctx: CanvasRenderingContext2D, screenPoint: Vector2): void {
  ctx.beginPath();
  ctx.arc(screenPoint.x, screenPoint.y, DRAFT_POINT_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.fill();
}
