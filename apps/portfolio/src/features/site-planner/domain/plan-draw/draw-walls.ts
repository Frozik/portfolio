import type { Vector2 } from '@frozik/utils/math/vector2';

import { isNil } from 'lodash-es';

import type { MultiPolygon } from '../geometry/polygon-types';
import type { OpeningId, OpeningKind } from '../model/openings';
import type { RoomTypeId } from '../model/rooms';
import type { RoofCover } from '../model/storeys';
import type { WallId, WallMaterial } from '../model/walls';
import type { PlanViewport } from '../view/plan-viewport';
import { planToScreen } from '../view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS, planMonoFont } from './shared';

const WALL_LINE_WIDTH_PX = 1.2;
const SELECTED_LINE_WIDTH_PX = 2.4;
const DRAFT_DASH_PATTERN_PX: readonly number[] = [5, 4];
const DRAFT_POINT_RADIUS_PX = 2.5;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

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
 * The walls of one building over its footprint: each body filled by material —
 * glazing stays translucent — and the selected one outlined in the accent.
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

  for (const wall of walls) {
    if (wall.polygons.length === 0) {
      continue;
    }

    const path = buildMultiPolygonPath(wall.polygons, viewport);
    const isSelected = wall.id === selectedWallId;

    ctx.fillStyle = wall.material === 'glazing' ? GLAZING_FILL : WALL_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : WALL_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : WALL_LINE_WIDTH_PX;
    ctx.stroke(path);
  }

  ctx.restore();
}

/** One opening as the drawing needs it: the cut it makes in its wall. */
export interface PlanOpening {
  readonly id: OpeningId;
  readonly kind: OpeningKind;
  readonly polygons: MultiPolygon;
}

/** A door reads as a clean break in the wall; a window as glass across it. */
const DOOR_FILL = 'rgba(13, 16, 22, 0.9)';
const WINDOW_FILL = 'rgba(148, 197, 250, 0.35)';
const OPENING_STROKE = '#cbd5e1';

/**
 * The cuts the openings make, painted over the wall bodies: a door breaks the
 * wall open, a window lays glass across the break. The selected one answers
 * in the accent.
 */
export function drawOpenings(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  openings: readonly PlanOpening[],
  selectedOpeningId?: OpeningId
): void {
  if (openings.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const opening of openings) {
    if (opening.polygons.length === 0) {
      continue;
    }

    const path = buildMultiPolygonPath(opening.polygons, viewport);
    const isSelected = opening.id === selectedOpeningId;

    ctx.fillStyle = opening.kind === 'door' ? DOOR_FILL : WINDOW_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : OPENING_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : WALL_LINE_WIDTH_PX;
    ctx.stroke(path);
  }

  ctx.restore();
}

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

const UPPER_OUTLINE_DASH_PX: readonly number[] = [6, 4];

/** Upper storeys read as dashed outlines over the ground plan. */
export function drawUpperFootprints(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  footprints: MultiPolygon
): void {
  if (footprints.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = PLAN_COLORS.houseStroke;
  ctx.lineWidth = WALL_LINE_WIDTH_PX;
  ctx.setLineDash([...UPPER_OUTLINE_DASH_PX]);
  ctx.stroke(buildMultiPolygonPath(footprints, viewport));
  ctx.restore();
}

/** The polyline of a wall being clicked out, dashed until it is committed. */
export function drawWallDraft(
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
}
