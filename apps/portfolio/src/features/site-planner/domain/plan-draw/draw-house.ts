import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { computeMultiPolygonCentroid } from '../geometry/polygon-centroid';
import type { MultiPolygon } from '../geometry/polygon-types';
import type { DeviceId } from '../model/electrical';
import type { UtilitySystem } from '../model/foundation';
import type { FurnitureId, FurnitureInstance } from '../model/furniture';
import type { OpeningId } from '../model/openings';
import type { RoomTypeId } from '../model/rooms';
import type { BuildingId } from '../model/site-plan';
import type { WallId } from '../model/walls';
import type { Meters } from '../units';
import type { PlanViewport } from '../view/plan-viewport';
import { planToScreen } from '../view/plan-viewport';
import type { PlanDeviceSymbol, PlanWireRun } from './draw-electrical';
import { drawElectrical } from './draw-electrical';
import { drawFurniture } from './draw-furniture';
import type { PlanOpening, PlanRoofZone, PlanRoom, PlanWallBody } from './draw-walls';
import {
  drawOpenings,
  drawRoofZones,
  drawRooms,
  drawUpperFootprints,
  drawWallBodies,
} from './draw-walls';
import {
  buildMultiPolygonPath,
  drawLabel,
  EDIT_DIM_ALPHA,
  formatMeters,
  PLAN_COLORS,
  planMonoFont,
} from './shared';

const HOUSE_LINE_WIDTH_PX = 1.8;
const SELECTED_LINE_WIDTH_PX = 2.4;
const ENTRY_RADIUS_PX = 6;
const ENTRY_LETTER_FONT_SIZE_PX = 8;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

/**
 * One colour per system, shared with the future route drawing — the letter on
 * the badge carries the meaning for a reader these hues say nothing to.
 */
export const UTILITY_SYSTEM_COLORS: Readonly<Record<UtilitySystem, string>> = {
  power: '#f59e0b',
  network: '#a78bfa',
  water: '#38bdf8',
  sewer: '#9ca3af',
  heating: '#f87171',
  ventilation: '#5eead4',
  gas: '#facc15',
};

/** One utility entry as the drawing needs it: which system, and where it enters. */
export interface PlanBuildingEntry {
  readonly system: UtilitySystem;
  readonly position: Vector2;
}

export interface HouseStyle {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly lineWidthPx: number;
}

const DEFAULT_HOUSE_STYLE: HouseStyle = {
  fillColor: PLAN_COLORS.houseFill,
  strokeColor: PLAN_COLORS.houseStroke,
  lineWidthPx: HOUSE_LINE_WIDTH_PX,
};

/** One building as the drawing needs it: its evaluated footprint, named and levelled. */
export interface PlanBuilding {
  readonly id: BuildingId;
  readonly name: string;
  readonly polygons: MultiPolygon;
  /** The level the footprint is levelled onto; absent while it has no shapes. */
  readonly padElevation: Meters | undefined;
  /** Where each system enters the building, resolved onto the outline. */
  readonly entries: readonly PlanBuildingEntry[];
  /** The walls drawn inside the footprint, each with its derived body. */
  readonly walls: readonly PlanWallBody[];
  /** The cuts the openings make in those walls. */
  readonly openings: readonly PlanOpening[];
  /** The regions the walls enclose; drawn only for the focused building. */
  readonly rooms: readonly PlanRoom[];
  /** The storey below the edited one, ghosting through as reference. */
  readonly referenceWalls: readonly PlanWallBody[];
  /** Upper storeys' outlines, dashed over the ground plan. */
  readonly upperFootprints: MultiPolygon;
  /** Terrace and green covers over the exposed ceilings, every storey's. */
  readonly roofZones: readonly PlanRoofZone[];
  /** The displayed storey's furniture. */
  readonly furniture: readonly FurnitureInstance[];
  /** The displayed storey's electrical plan. */
  readonly devices: readonly PlanDeviceSymbol[];
  readonly wires: readonly PlanWireRun[];
}

/**
 * Paints every building's evaluated footprint over the plot, each captioned
 * with its name and the level it is to stand on. Like the boundary, an outline
 * is the result of the boolean fold — the subtracted terms of a composition
 * appear only as holes and are never outlined on their own.
 */
export function drawBuildings(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    buildings,
    selectedBuildingId,
    padLabelPrefix,
    meterUnit,
    entryLetters,
    focusBuildingId,
    selectedWallId,
    selectedOpeningId,
    selectedFurnitureId,
    selectedDeviceId,
    pendingConnectDeviceId,
    hoveredRoomIndex,
    roomTypeNames,
    squareMeterUnit,
  }: {
    readonly buildings: readonly PlanBuilding[];
    readonly selectedBuildingId?: BuildingId;
    readonly padLabelPrefix: string;
    readonly meterUnit: string;
    readonly entryLetters: Readonly<Record<UtilitySystem, string>>;
    /** The building whose editor is open; every other one steps back dimmed. */
    readonly focusBuildingId?: BuildingId;
    readonly selectedWallId?: WallId;
    readonly selectedOpeningId?: OpeningId;
    readonly selectedFurnitureId?: FurnitureId;
    readonly selectedDeviceId?: DeviceId;
    readonly pendingConnectDeviceId?: DeviceId;
    /** The КОМНАТЫ row under the pointer; that room answers lit on the plan. */
    readonly hoveredRoomIndex?: number;
    readonly roomTypeNames: Readonly<Record<RoomTypeId, string>>;
    readonly squareMeterUnit: string;
  },
  style: HouseStyle = DEFAULT_HOUSE_STYLE
): void {
  for (const building of buildings) {
    if (building.polygons.length === 0 && building.walls.length === 0) {
      continue;
    }

    const isDimmed = focusBuildingId !== undefined && building.id !== focusBuildingId;

    ctx.save();

    if (isDimmed) {
      ctx.globalAlpha = EDIT_DIM_ALPHA;
    }

    const isSelected = building.id === selectedBuildingId;
    const path = buildMultiPolygonPath(building.polygons, viewport);

    ctx.fillStyle = style.fillColor;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : style.strokeColor;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : style.lineWidthPx;
    ctx.lineJoin = 'round';
    ctx.stroke(path);

    drawRoofZones(ctx, viewport, building.roofZones);

    if (building.id === focusBuildingId) {
      drawRooms(ctx, viewport, building.rooms, {
        roomTypeNames,
        squareMeterUnit,
        hoveredRoomIndex,
      });

      if (building.referenceWalls.length > 0) {
        ctx.save();
        ctx.globalAlpha = EDIT_DIM_ALPHA;
        drawWallBodies(ctx, viewport, building.referenceWalls);
        ctx.restore();
      }
    }

    drawWallBodies(ctx, viewport, building.walls, selectedWallId);
    drawOpenings(ctx, viewport, building.openings, selectedOpeningId);
    drawFurniture(ctx, viewport, building.furniture, selectedFurnitureId);
    drawElectrical(ctx, viewport, {
      devices: building.devices,
      wires: building.wires,
      selectedDeviceId,
      pendingConnectDeviceId,
    });
    drawUpperFootprints(ctx, viewport, building.upperFootprints);

    const centroid = computeMultiPolygonCentroid(building.polygons);

    if (!isNil(centroid)) {
      const level = isNil(building.padElevation)
        ? undefined
        : `${padLabelPrefix} ${formatMeters(building.padElevation, meterUnit)}`;

      drawLabel(
        ctx,
        isNil(level) ? building.name : `${building.name} · ${level}`,
        planToScreen(viewport, centroid)
      );
    }

    ctx.restore();
  }

  for (const building of buildings) {
    if (focusBuildingId === undefined || building.id === focusBuildingId) {
      drawUtilityEntries(ctx, viewport, building.entries, entryLetters);
    }
  }
}

/**
 * The badges on the outline that answer «где в дом заходит электричество, где
 * газ»: a disc in the system's colour wearing the system's letter. Drawn after
 * every footprint, so a badge is never painted over by a neighbour.
 */
function drawUtilityEntries(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  entries: readonly PlanBuildingEntry[],
  entryLetters: Readonly<Record<UtilitySystem, string>>
): void {
  if (entries.length === 0) {
    return;
  }

  ctx.save();
  ctx.font = planMonoFont(ENTRY_LETTER_FONT_SIZE_PX);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;

  for (const entry of entries) {
    const { x, y } = planToScreen(viewport, entry.position);

    ctx.beginPath();
    ctx.arc(x, y, ENTRY_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.fillStyle = UTILITY_SYSTEM_COLORS[entry.system];
    ctx.fill();
    ctx.strokeStyle = PLAN_COLORS.labelBackdrop;
    ctx.stroke();
    ctx.fillStyle = PLAN_COLORS.labelBackdrop;
    ctx.fillText(entryLetters[entry.system], x, y);
  }

  ctx.restore();
}
