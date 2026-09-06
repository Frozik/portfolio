import { isNil } from 'lodash-es';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { RoomTypeId } from '../../../domain/model/rooms';
import type { RoofCover } from '../../../domain/model/storeys';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS, planMonoFont } from './shared';

/** One derived room as the drawing needs it: its region, type and wetness. */
export interface PlanRoom {
  readonly polygons: MultiPolygon;
  readonly roomTypeId: RoomTypeId | undefined;
  readonly areaSquareMeters: number;
  readonly centroid: { readonly x: number; readonly y: number } | undefined;
  readonly isWet: boolean;
}

/** Wet rooms wash cool over the floor, the plumbing convention. */
const WET_ROOM_FILL = 'rgba(56, 189, 248, 0.10)';

/** How the panel's hovered room answers on the sheet: its region, lit. */
const HOVERED_ROOM_FILL = 'rgba(96, 165, 250, 0.28)';

const HOVERED_ROOM_LINE_WIDTH_PX = 2;

const ROOM_LABEL_FONT_SIZE_PX = 10;

const ROOM_AREA_DECIMALS = 1;

/**
 * The rooms the walls cut the footprint into, drawn only inside the building
 * editor: wet zones tinted, every region captioned with its type and area,
 * the one under the panel's pointer lit so the row and the region read as one.
 */
export function drawRooms(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  rooms: readonly PlanRoom[],
  {
    roomTypeNames,
    squareMeterUnit,
    hoveredRoomIndex,
  }: {
    readonly roomTypeNames: Readonly<Record<RoomTypeId, string>>;
    readonly squareMeterUnit: string;
    readonly hoveredRoomIndex?: number;
  }
): void {
  if (rooms.length === 0) {
    return;
  }

  ctx.save();
  ctx.font = planMonoFont(ROOM_LABEL_FONT_SIZE_PX);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [index, room] of rooms.entries()) {
    if (room.isWet) {
      ctx.fillStyle = WET_ROOM_FILL;
      ctx.fill(buildMultiPolygonPath(room.polygons, viewport), 'nonzero');
    }

    if (index === hoveredRoomIndex) {
      const path = buildMultiPolygonPath(room.polygons, viewport);

      ctx.fillStyle = HOVERED_ROOM_FILL;
      ctx.fill(path, 'nonzero');
      ctx.strokeStyle = PLAN_COLORS.boundaryStroke;
      ctx.lineWidth = HOVERED_ROOM_LINE_WIDTH_PX;
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }

    if (isNil(room.centroid)) {
      continue;
    }

    const area = `${room.areaSquareMeters.toFixed(ROOM_AREA_DECIMALS)} ${squareMeterUnit}`;
    const caption = isNil(room.roomTypeId) ? area : `${roomTypeNames[room.roomTypeId]} · ${area}`;
    const { x, y } = planToScreen(viewport, room.centroid);

    ctx.fillStyle = PLAN_COLORS.textStrong;
    ctx.fillText(caption, x, y);
  }

  ctx.restore();
}

/** One roof zone as the drawing needs it: where it lies and what covers it. */
export interface PlanRoofZone {
  readonly polygons: MultiPolygon;
  readonly cover: RoofCover;
}

/** Planting reads green, a walkable deck reads warm; membrane is not drawn. */
const ROOF_ZONE_FILLS: Readonly<Record<RoofCover, string | undefined>> = {
  membrane: undefined,
  green: 'rgba(74, 222, 128, 0.18)',
  terrace: 'rgba(217, 180, 120, 0.2)',
};

/** The covers over the exposed ceilings — the надстройка's terrace, the green roof. */
export function drawRoofZones(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  zones: readonly PlanRoofZone[]
): void {
  if (zones.length === 0) {
    return;
  }

  ctx.save();

  for (const zone of zones) {
    const fill = ROOF_ZONE_FILLS[zone.cover];

    if (fill === undefined || zone.polygons.length === 0) {
      continue;
    }

    ctx.fillStyle = fill;
    ctx.fill(buildMultiPolygonPath(zone.polygons, viewport), 'nonzero');
  }

  ctx.restore();
}
