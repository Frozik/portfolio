import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { DeviceId, DeviceKind } from '../../../domain/model/electrical';
import type { InstallationKind } from '../../../domain/model/installation';
import type { WiringRouteId } from '../../../domain/model/wiring-routes';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { PLAN_COLORS } from './shared';

const SYMBOL_RADIUS_PX = 6;
const PANEL_HALF_PX = 7;
const TICK_PX = 5;
const WIRE_LINE_WIDTH_PX = 1.1;
const LINK_DASH_PX: readonly number[] = [4, 3];
const SELECTED_LINE_WIDTH_PX = 2.2;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

/** The power colour the utility palette already speaks. */
const WIRE_COLOR = '#f59e0b';
const SYMBOL_FILL = 'rgba(245, 158, 11, 0.18)';
/** A drawn route reads as the conduit under the wires: wider, fainter. */
const ROUTE_COLOR = 'rgba(245, 158, 11, 0.4)';
/** Zoomed out, a conduit is still a stroke; zoomed in, it is as wide as it is. */
export const MIN_ROUTE_LINE_WIDTH_PX = 2;
const SELECTED_ROUTE_EXTRA_PX = 1;
/** A dark edge under every stroke, so conduits laid touching still read apart. */
const ROUTE_EDGE_COLOR = 'rgba(28, 25, 23, 0.9)';
const ROUTE_EDGE_PX = 1;
/** A chase reads dashed — it is cut into the wall, not laid on it. */
const CHASE_DASH_PX: readonly number[] = [6, 3];
const OPEN_DASH_PX: readonly number[] = [2, 3];
const DRAFT_DASH_PX: readonly number[] = [5, 4];
const DRAFT_POINT_RADIUS_PX = 2.5;

/** One drawn route as the plan draws it: its bends and how each stretch is laid. */
export interface PlanWiringRoute {
  readonly id: WiringRouteId;
  readonly points: readonly Vector2[];
  /** One per stretch, what the stroke reads its dash from. */
  readonly installations: readonly InstallationKind[];
  /** One per stretch: how wide the conduit lies, so bundles read side by side. */
  readonly widthsMeters: readonly number[];
}

/** One device symbol as the drawing needs it. */
export interface PlanDeviceSymbol {
  readonly id: DeviceId;
  readonly kind: DeviceKind;
  readonly position: Vector2;
}

/** One derived wire run; a switch link dashes, a circuit run stays solid. */
export interface PlanWireRun {
  readonly points: readonly Vector2[];
  readonly isSwitchLink: boolean;
}

/**
 * The electrical plan of the displayed storey: the wires first — panel to
 * every consumer along the walls, switch to light dashed — then the standard
 * symbols over them. The pending half of a connect gesture pulses in the
 * accent, so the first click stays visible while the second is aimed.
 */
export function drawElectrical(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    devices,
    wires,
    routes,
    selectedDeviceId,
    pendingConnectDeviceId,
    selectedWiringRouteId,
  }: {
    readonly devices: readonly PlanDeviceSymbol[];
    readonly wires: readonly PlanWireRun[];
    readonly routes: readonly PlanWiringRoute[];
    readonly selectedDeviceId?: DeviceId;
    readonly pendingConnectDeviceId?: DeviceId;
    readonly selectedWiringRouteId?: WiringRouteId;
  }
): void {
  if (devices.length === 0 && wires.length === 0 && routes.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const route of routes) {
    drawRoute(ctx, viewport, route, route.id === selectedWiringRouteId);
  }

  ctx.strokeStyle = WIRE_COLOR;
  ctx.lineWidth = WIRE_LINE_WIDTH_PX;

  for (const wire of wires) {
    if (wire.points.length < 2) {
      continue;
    }

    ctx.setLineDash(wire.isSwitchLink ? [...LINK_DASH_PX] : []);
    ctx.beginPath();

    wire.points.forEach((point, index) => {
      const screen = planToScreen(viewport, point);

      if (index === 0) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    });

    ctx.stroke();
  }

  ctx.setLineDash([]);

  for (const device of devices) {
    const isHighlighted = device.id === selectedDeviceId || device.id === pendingConnectDeviceId;

    ctx.strokeStyle = isHighlighted ? PLAN_COLORS.selectionStroke : WIRE_COLOR;
    ctx.lineWidth = isHighlighted ? SELECTED_LINE_WIDTH_PX : WIRE_LINE_WIDTH_PX;
    ctx.fillStyle = SYMBOL_FILL;
    drawSymbol(ctx, planToScreen(viewport, device.position), device.kind);
  }

  ctx.restore();
}

/** Each stretch in the dash of its method, so a chase and a conduit tell apart at a glance. */
function drawRoute(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  route: PlanWiringRoute,
  isSelected: boolean
): void {
  route.installations.forEach((installation, index) => {
    const from = planToScreen(viewport, route.points[index]);
    const to = planToScreen(viewport, route.points[index + 1]);
    const width =
      Math.max(route.widthsMeters[index] * viewport.pixelsPerMeter, MIN_ROUTE_LINE_WIDTH_PX) +
      (isSelected ? SELECTED_ROUTE_EXTRA_PX : 0);

    ctx.setLineDash(dashFor(installation));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = ROUTE_EDGE_COLOR;
    ctx.lineWidth = width + ROUTE_EDGE_PX;
    ctx.stroke();
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : ROUTE_COLOR;
    ctx.lineWidth = width;
    ctx.stroke();
  });

  ctx.setLineDash([]);
}

function dashFor(installation: InstallationKind): number[] {
  switch (installation) {
    case 'chase':
      return [...CHASE_DASH_PX];
    case 'open':
      return [...OPEN_DASH_PX];
    case 'conduit':
    case 'trunking':
    case 'tray':
    case 'pipe':
      return [];
    default:
      return assertNever(installation);
  }
}

/** The route being clicked out, dashed until Enter lays it. */
export function drawWiringRouteDraft(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  points: readonly Vector2[]
): void {
  if (points.length === 0) {
    return;
  }

  const screenPoints = points.map(point => planToScreen(viewport, point));

  ctx.save();
  ctx.strokeStyle = PLAN_COLORS.selectionStroke;
  ctx.fillStyle = PLAN_COLORS.selectionStroke;
  ctx.lineWidth = WIRE_LINE_WIDTH_PX;
  ctx.setLineDash([...DRAFT_DASH_PX]);
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
}

/** The standard-plan glyphs: щиток square, socket ticks, switch stroke, light cross. */
function drawSymbol(ctx: CanvasRenderingContext2D, at: Vector2, kind: DeviceKind): void {
  switch (kind) {
    case 'panel':
      ctx.beginPath();
      ctx.rect(at.x - PANEL_HALF_PX, at.y - PANEL_HALF_PX, PANEL_HALF_PX * 2, PANEL_HALF_PX * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(at.x - PANEL_HALF_PX, at.y + PANEL_HALF_PX);
      ctx.lineTo(at.x + PANEL_HALF_PX, at.y - PANEL_HALF_PX);
      ctx.stroke();

      return;
    case 'outlet':
      drawCircle(ctx, at);
      ctx.beginPath();
      ctx.moveTo(at.x - TICK_PX, at.y - SYMBOL_RADIUS_PX);
      ctx.lineTo(at.x - TICK_PX, at.y - SYMBOL_RADIUS_PX - TICK_PX);
      ctx.moveTo(at.x + TICK_PX, at.y - SYMBOL_RADIUS_PX);
      ctx.lineTo(at.x + TICK_PX, at.y - SYMBOL_RADIUS_PX - TICK_PX);
      ctx.stroke();

      return;
    case 'switch':
      drawCircle(ctx, at);
      ctx.beginPath();
      ctx.moveTo(at.x, at.y - SYMBOL_RADIUS_PX);
      ctx.lineTo(at.x + TICK_PX, at.y - SYMBOL_RADIUS_PX - TICK_PX);
      ctx.stroke();

      return;
    case 'light':
      drawCircle(ctx, at);
      ctx.beginPath();
      ctx.moveTo(at.x - TICK_PX, at.y - TICK_PX);
      ctx.lineTo(at.x + TICK_PX, at.y + TICK_PX);
      ctx.moveTo(at.x - TICK_PX, at.y + TICK_PX);
      ctx.lineTo(at.x + TICK_PX, at.y - TICK_PX);
      ctx.stroke();

      return;
    default:
      assertNever(kind);
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, at: Vector2): void {
  ctx.beginPath();
  ctx.arc(at.x, at.y, SYMBOL_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.fill();
  ctx.stroke();
}
