import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { DeviceId, DeviceKind } from '../model/electrical';
import type { PlanViewport } from '../view/plan-viewport';
import { planToScreen } from '../view/plan-viewport';
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
    selectedDeviceId,
    pendingConnectDeviceId,
  }: {
    readonly devices: readonly PlanDeviceSymbol[];
    readonly wires: readonly PlanWireRun[];
    readonly selectedDeviceId?: DeviceId;
    readonly pendingConnectDeviceId?: DeviceId;
  }
): void {
  if (devices.length === 0 && wires.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';
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
