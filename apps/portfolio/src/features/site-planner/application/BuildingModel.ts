import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { computeMultiPolygonBounds } from '../domain/geometry/bounding-box';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import type { BuildingId, PadElevationMode } from '../domain/model/building';
import { createBuilding, foundationOf } from '../domain/model/building';
import type { Building } from '../domain/model/building';
import {
  addBuilding as addBuildingIn,
  findBuilding as findBuildingIn,
  removeBuilding as removeBuildingIn,
  replaceBuilding as replaceBuildingIn,
  rotateBuilding,
  updateBuilding as updateBuildingIn,
  updateFoundation as updateFoundationIn,
} from '../domain/model/building-edits';
import { findFreeBuildingSpot } from '../domain/model/building-placement';
import type { BuildingPresetId } from '../domain/model/building-presets';
import { findBuildingPreset, presetUtilityEntries } from '../domain/model/building-presets';
import { instantiateBuildingTemplate } from '../domain/model/building-template';
import { isSiteEditMode } from '../domain/model/editor-mode';
import type { Foundation } from '../domain/model/foundation';
import type { RoomTypeId } from '../domain/model/rooms';
import { createRoomLabel } from '../domain/model/rooms';
import type { Selection } from '../domain/model/selection';
import { frostDepthOf } from '../domain/model/site-plan';
import {
  removeRoomLabel as removeRoomLabelFrom,
  upsertRoomLabel as upsertRoomLabelIn,
} from '../domain/model/storey-edits';
import { normalizeBuildingWallCrossings } from '../domain/model/wall-topology';
import { findStockHouseTemplate } from '../domain/templates/stock-houses';
import type { Meters } from '../domain/units';
import type { CompositionModel } from './CompositionModel';
import type { PlanEditorCore } from './editor-core';
import type { BuildingRoom } from './room-scenes';
import type { SceneModel } from './SceneModel';
import { seedPointOf } from './storey-scenes';

/**
 * The buildings as buildings: their lifecycle on the plot, the pad and the
 * foundation they stand on, the room labels. Commands write the document
 * through the core; everything resolved against the terrain is read back from
 * the scene. The storey stack lives in {@link StoreysModel}, the roof in
 * {@link RoofModel}.
 */
/** History groups of the house fields, so a typed number stays one step to undo. */
const MANUAL_PAD_HISTORY_GROUP = 'house:manual-pad';
const PAD_DROP_HISTORY_GROUP = 'house:pad-drop';
const WALL_HEIGHT_HISTORY_GROUP = 'house:wall-height';
const FOUNDATION_HISTORY_GROUP = 'foundation';

const NO_SELECTIONS: readonly Selection[] = [];

export class BuildingModel {
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;
  private readonly composition: CompositionModel;

  constructor(core: PlanEditorCore, scene: SceneModel, composition: CompositionModel) {
    this.core = core;
    this.scene = scene;
    this.composition = composition;

    makeAutoObservable<BuildingModel, 'core' | 'scene' | 'composition'>(
      this,
      { core: false, scene: false, composition: false },
      { autoBind: true }
    );
  }

  get selectedBuilding(): Building | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'building'
      ? undefined
      : findBuildingIn(this.core.buildings, selection.buildingId);
  }

  /**
   * The rail's «Строение» button: the house is drawn inside site editing, so
   * this opens that editor already aimed at it — new shapes land in the house
   * group and the drawing tool is in hand, one click from a footprint. From
   * inside site editing it only re-aims: the editor, the selection and the
   * undo trail all stay put.
   */
  enterBuildingEditing(defaultName: string): void {
    if (!isSiteEditMode(this.core.editorMode)) {
      this.core.enterEditMode({ kind: 'site' });
    }

    const [first] = this.core.buildings;

    if (isNil(first)) {
      // A plan with no structures yet: the button also mints the first one.
      this.addBuilding(defaultName);
    } else if (this.composition.activeGroup.owner === 'boundary') {
      this.composition.setActiveGroup(first.id);
    }

    this.core.setActiveTool(this.core.armedShapeTool);
  }

  /**
   * Switching to the manual mode carries over whatever the terrain modes were
   * giving, so the field opens on the number the user has just been looking at
   * rather than on the site datum.
   */
  setPadElevationMode(buildingId: BuildingId, padElevationMode: PadElevationMode): void {
    const building = findBuildingIn(this.core.buildings, buildingId);
    const scene = this.scene.buildingScenes.find(candidate => candidate.building.id === buildingId);

    if (isNil(building)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = updateBuildingIn(this.core.buildings, buildingId, {
      padElevationMode,
      manualPadElevation:
        padElevationMode === 'manual'
          ? (building.manualPadElevation ?? scene?.padElevation)
          : building.manualPadElevation,
    });
  }

  setManualPadElevation(buildingId: BuildingId, manualPadElevation: Meters): void {
    this.core.pushHistory(`${MANUAL_PAD_HISTORY_GROUP}:${buildingId}`);
    this.core.buildings = updateBuildingIn(this.core.buildings, buildingId, { manualPadElevation });
  }

  setPadDrop(buildingId: BuildingId, padDropMeters: Meters): void {
    this.core.pushHistory(`${PAD_DROP_HISTORY_GROUP}:${buildingId}`);
    this.core.buildings = updateBuildingIn(this.core.buildings, buildingId, { padDropMeters });
  }

  setWallHeight(buildingId: BuildingId, wallHeight: Meters): void {
    this.core.pushHistory(`${WALL_HEIGHT_HISTORY_GROUP}:${buildingId}`);
    this.core.buildings = updateBuildingIn(this.core.buildings, buildingId, { wallHeight });
  }

  /**
   * Edits a building's foundation field by field. Typed numbers group per
   * building, so a burst of keystrokes stays one step to undo.
   */
  updateFoundation(buildingId: BuildingId, changes: Partial<Foundation>): void {
    this.core.pushHistory(`${FOUNDATION_HISTORY_GROUP}:${buildingId}`);
    this.core.buildings = updateFoundationIn(this.core.buildings, buildingId, changes);
  }

  /**
   * Assigns — or clears — a derived room's type by pinning a label to a seed
   * point inside the region: the room itself is
   * never stored, so whichever region holds the point wears the type.
   */
  setRoomType(
    buildingId: BuildingId,
    room: BuildingRoom,
    roomTypeId: RoomTypeId | undefined
  ): void {
    this.core.pushHistory();

    if (isNil(roomTypeId)) {
      if (!isNil(room.labelId)) {
        this.core.buildings = removeRoomLabelFrom(this.core.buildings, buildingId, room.labelId);
      }

      return;
    }

    const position = seedPointOf(room.polygons, room.centroid);

    if (isNil(position)) {
      return;
    }

    const label = isNil(room.labelId)
      ? createRoomLabel({ position, roomTypeId })
      : { id: room.labelId, position, roomTypeId };

    this.core.buildings = upsertRoomLabelIn(this.core.buildings, buildingId, room.storeyId, label);
  }

  /**
   * Turns the whole selected building about its footprint centre — walls,
   * furnishings and the roof's ridge together. History-less: the grip gesture
   * announces one step on pointer-down, exactly like turning a car.
   */
  turnWholeBuilding(startBuilding: Building, byDegrees: number): void {
    const bounds = computeMultiPolygonBounds(evaluateComposition(startBuilding.composition));

    if (isNil(bounds)) {
      return;
    }

    const pivot: Vector2 = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };

    this.core.buildings = replaceBuildingIn(
      this.core.buildings,
      rotateBuilding(startBuilding, byDegrees, pivot)
    );
  }

  /**
   * Stamps a stock house from the catalogue onto the plot: fresh ids, centred
   * on a free spot, selected — from there it is any other building.
   */
  placeStockHouse(templateId: string): Building | undefined {
    const template = findStockHouseTemplate(templateId);

    if (isNil(template)) {
      return undefined;
    }

    return this.placeReadyBuilding(template.building);
  }

  /**
   * Places a complete building brought from outside (a template file, one day
   * a converter) the same way a stock house lands: reminted, centred, selected.
   */
  placeReadyBuilding(building: Building): Building {
    const spot = findFreeBuildingSpot(building, this.core.boundaryPolygons, this.core.buildings);
    const placed = instantiateBuildingTemplate({ id: 'imported', building }, spot);

    this.core.pushHistory();
    this.core.buildings = addBuildingIn(this.core.buildings, placed);
    // Authored templates keep their wall literals lean; the junction vertices
    // at every T-стык derive here, so a placed house is editable node by node.
    this.core.buildings = normalizeBuildingWallCrossings(this.core.buildings, placed.id);
    this.core.setSelection({ kind: 'building', buildingId: placed.id });

    return placed;
  }

  /** Mints a named structure and aims the editor at it, ready to draw. */
  addBuilding(name: string, presetId?: BuildingPresetId): Building {
    const preset = isNil(presetId) ? undefined : findBuildingPreset(presetId);
    const created = createBuilding({ name });
    // A preset only seeds the data — a carport starts on piers with a lower
    // roof, a shed lower still — and everything stays editable afterwards.
    const building = isNil(preset)
      ? created
      : {
          ...created,
          wallHeight: preset.wallHeightMeters,
          foundation: { ...foundationOf(created), kind: preset.foundationKind },
          // A stock building comes with its utility entries already on the
          // outline — the badges appear once a footprint exists, and from
          // then on the plot work is routing trenches to them, not placing
          // entries by hand.
          entries: presetUtilityEntries(preset, frostDepthOf(this.core.settings)),
        };

    this.core.pushHistory();
    this.core.buildings = addBuildingIn(this.core.buildings, building);
    this.composition.setActiveGroup(building.id);

    return building;
  }

  renameBuilding(buildingId: BuildingId, name: string): void {
    this.core.pushHistory(`building:${buildingId}:name`);
    this.core.buildings = updateBuildingIn(this.core.buildings, buildingId, { name });
  }

  removeBuilding(buildingId: BuildingId): void {
    this.core.pushHistory();
    this.core.buildings = removeBuildingIn(this.core.buildings, buildingId);

    const { selection } = this.core;
    const { activeGroup } = this.composition;

    if (
      !isNil(selection) &&
      ((selection.kind === 'building' && selection.buildingId === buildingId) ||
        ((selection.kind === 'shape' || selection.kind === 'group') &&
          selection.owner === buildingId))
    ) {
      this.core.selections = NO_SELECTIONS;
    }

    if (activeGroup.owner === buildingId) {
      this.composition.setActiveGroup('boundary');
    }
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
