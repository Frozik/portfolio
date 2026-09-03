import type { Vector2 } from '@frozik/utils/math/vector2';

import { isNil } from 'lodash-es';
import type { SegmentReadout } from '../../../domain/geometry/draw-constraints';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { DoorSwingGeometry } from '../../../domain/geometry/wall-geometry';
import type { OpeningId, OpeningKind } from '../../../domain/model/openings';
import type { RoomTypeId } from '../../../domain/model/rooms';
import type { RoofCover } from '../../../domain/model/storeys';
import type { WallId, WallMaterial } from '../../../domain/model/walls';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import {
  buildMultiPolygonPath,
  drawLabel,
  formatMeters,
  PLAN_COLORS,
  planMonoFont,
} from './shared';

const WALL_LINE_WIDTH_PX = 1.2;
const SELECTED_LINE_WIDTH_PX = 2.4;
const DRAFT_DASH_PATTERN_PX: readonly number[] = [5, 4];
const DRAFT_POINT_RADIUS_PX = 2.5;
/** The readout rides above the cursor so the pointer never covers it. */
const DRAFT_READOUT_OFFSET_PX = 18;
const DRAFT_READOUT_DECIMALS = 2;
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
  /** How a door's leaf hangs and sweeps; nothing for a window. */
  readonly swing?: DoorSwingGeometry;
}

/** A door reads as a clean break in the wall; a window as glass across it. */
const DOOR_FILL = 'rgba(13, 16, 22, 0.9)';
const WINDOW_FILL = 'rgba(148, 197, 250, 0.35)';
const OPENING_STROKE = '#cbd5e1';
/** The leaf reads solid, the sweep it needs kept clear reads dashed. */
const SWING_STROKE = 'rgba(203, 213, 225, 0.75)';
const SWING_LINE_WIDTH_PX = 1;
const SWING_DASH_PATTERN_PX: readonly number[] = [3, 3];
/**
 * A floor you can stand on, and it has to look like one (R28). The first take
 * was opaque but nearly the colour of the plot behind it, so an overhang still
 * read as a hole — «opaque» is not the same as «legible». This is the tone the
 * house itself is filled with, one step lighter, so the strip beyond the storey
 * below reads as a room over a carport rather than as a gap.
 */
const OVERHANG_FLOOR_FILL = 'rgba(96, 165, 250, 0.14)';
const OVERHANG_FLOOR_BACKDROP = '#0d1016';

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

    if (!isNil(opening.swing)) {
      drawDoorSwing(ctx, viewport, opening.swing);
    }
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
/**
 * The floor of a storey where it reaches past the one below (R28). An overhang
 * is FLOOR — you can stand on it — so it is filled solid: leaving the plot
 * showing through it read as a hole in the building rather than as a room over
 * a carport.
 */
export function drawOverhangFloor(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  overhang: MultiPolygon
): void {
  if (overhang.length === 0) {
    return;
  }

  const path = buildMultiPolygonPath(overhang, viewport);

  ctx.save();
  // Two coats: an opaque one so nothing of the plot shows through the floor,
  // and the house's own tint over it so it reads as part of the building.
  ctx.fillStyle = OVERHANG_FLOOR_BACKDROP;
  ctx.fill(path, 'nonzero');
  ctx.fillStyle = OVERHANG_FLOOR_FILL;
  ctx.fill(path, 'nonzero');
  ctx.strokeStyle = PLAN_COLORS.houseStroke;
  ctx.lineWidth = WALL_LINE_WIDTH_PX;
  ctx.stroke(path);
  ctx.restore();
}

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
/**
 * The leaf and the quarter arc it sweeps — the convention every floor plan
 * since the drawing board has used to say which way a door opens and where it
 * must be kept clear.
 */
function drawDoorSwing(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  swing: DoorSwingGeometry
): void {
  const hinge = planToScreen(viewport, swing.hinge);
  const leafEnd = planToScreen(viewport, swing.leafEnd);
  const radiusPx = swing.radiusMeters * viewport.pixelsPerMeter;

  ctx.save();
  ctx.strokeStyle = SWING_STROKE;
  ctx.lineWidth = SWING_LINE_WIDTH_PX;

  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y);
  ctx.lineTo(leafEnd.x, leafEnd.y);
  ctx.stroke();

  ctx.setLineDash([...SWING_DASH_PATTERN_PX]);
  ctx.beginPath();
  // Plan y runs north but the canvas y runs down, so the sweep is mirrored on
  // screen: the arc that turns left on the plan turns right here.
  ctx.arc(
    hinge.x,
    hinge.y,
    radiusPx,
    -swing.startAngle,
    -swing.endAngle,
    !swing.isCounterClockwise
  );
  ctx.stroke();
  ctx.restore();
}

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
