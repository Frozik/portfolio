import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { defaultRidgeDegrees } from '../domain/geometry/pitched-roof';
import {
  addBuilding as addBuildingIn,
  findBuilding as findBuildingIn,
  removeBuilding as removeBuildingIn,
  updateBuilding as updateBuildingIn,
  updateFoundation as updateFoundationIn,
} from '../domain/model/building-edits';
import type { BuildingPresetId } from '../domain/model/building-presets';
import { findBuildingPreset } from '../domain/model/building-presets';
import { isSiteEditMode } from '../domain/model/editor-mode';
import type { Foundation } from '../domain/model/foundation';
import type { Opening } from '../domain/model/openings';
import type { PitchedRoof } from '../domain/model/roofs';
import { createPitchedRoof } from '../domain/model/roofs';
import type { RoomTypeId } from '../domain/model/rooms';
import { createRoomLabel } from '../domain/model/rooms';
import type { Selection } from '../domain/model/selection';
import { createShapeId } from '../domain/model/shapes';
import type { Building, BuildingId, PadElevationMode } from '../domain/model/site-plan';
import { createBuilding, foundationOf, pitchedRoofOf, storeysOf } from '../domain/model/site-plan';
import {
  addStorey as addStoreyIn,
  removeRoofZoneLabel as removeRoofZoneLabelFrom,
  removeRoomLabel as removeRoomLabelFrom,
  removeStorey as removeStoreyFrom,
  setPitchedRoof as setPitchedRoofIn,
  updateStoreyHeight as updateStoreyHeightIn,
  upsertRoofZoneLabel as upsertRoofZoneLabelIn,
  upsertRoomLabel as upsertRoomLabelIn,
} from '../domain/model/storey-edits';
import type { RoofCover, StoreyId } from '../domain/model/storeys';
import {
  createRoofZoneLabel,
  createStorey,
  DEFAULT_ROOF_COVER,
  slabsOf,
} from '../domain/model/storeys';
import type { Wall } from '../domain/model/walls';
import type { Meters } from '../domain/units';
import type { CompositionModel } from './CompositionModel';
import type { PlanEditorCore } from './editor-core';
import type { PitchedRoofScene } from './roof-scenes';
import type { SceneModel } from './SceneModel';
import type { BuildingRoom, RoofZoneScene, StoreyScene } from './storey-scenes';
import { seedPointOf } from './storey-scenes';

/**
 * The buildings as buildings: their lifecycle on the plot, the pad and the
 * foundation they stand on, their storeys with the active one the editor is
 * aimed at, the pitched roof, the room labels. Commands write the document
 * through the core; everything resolved against the terrain is read back from
 * the scene.
 */
/** History groups of the house fields, so a typed number stays one step to undo. */
const MANUAL_PAD_HISTORY_GROUP = 'house:manual-pad';
const WALL_HEIGHT_HISTORY_GROUP = 'house:wall-height';
const FOUNDATION_HISTORY_GROUP = 'foundation';
const PITCHED_ROOF_HISTORY_GROUP = 'building:roof';
const STOREY_HEIGHT_HISTORY_GROUP = 'building:storey-height';

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
   * Crowns the edited building with a pitched roof, or takes it off. The ridge
   * starts along the top storey's longer side — the way a roof is actually
   * framed — so the default already looks like a house.
   */
  togglePitchedRoof(): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const scene = this.scene.buildingScenes.find(
      candidate => candidate.building.id === session.buildingId
    );
    const top = scene?.storeys[scene.storeys.length - 1];

    this.core.pushHistory();
    this.core.buildings = setPitchedRoofIn(
      this.core.buildings,
      session.buildingId,
      isNil(scene?.pitchedRoof)
        ? createPitchedRoof({
            ridgeDegrees: isNil(top) ? 0 : defaultRidgeDegrees(top.footprint),
          })
        : undefined
    );
  }

  /** Changes one property of the roof; a typed number stays one step to undo. */
  updatePitchedRoof(changes: Partial<PitchedRoof>): void {
    const session = this.core.editorSession;
    const roof = this.editedPitchedRoof;

    if (session?.kind !== 'building' || isNil(roof)) {
      return;
    }

    this.core.pushHistory(PITCHED_ROOF_HISTORY_GROUP);
    this.core.buildings = setPitchedRoofIn(this.core.buildings, session.buildingId, {
      ...roof,
      ...changes,
    });
  }

  /** The edited building's roof, or nothing while its top is flat. */
  get editedPitchedRoof(): PitchedRoof | undefined {
    const session = this.core.editorSession;
    const building =
      session?.kind === 'building'
        ? findBuildingIn(this.core.buildings, session.buildingId)
        : undefined;

    return isNil(building) ? undefined : pitchedRoofOf(building);
  }

  /** The edited building's roof as it was resolved — heights and all. */
  get editedPitchedRoofScene(): PitchedRoofScene | undefined {
    const session = this.core.editorSession;

    return session?.kind !== 'building'
      ? undefined
      : this.scene.buildingScenes.find(candidate => candidate.building.id === session.buildingId)
          ?.pitchedRoof;
  }

  /**
   * Assigns — or clears — a derived room's type by pinning a label to a seed
   * point inside the region (`building-editor.md` §4): the room itself is
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
   * Pins — or clears — a roof zone's cover by its seed point, exactly the way
   * a room's type is pinned. Membrane is the default, so choosing it back
   * simply removes the label.
   */
  setRoofCover(buildingId: BuildingId, zone: RoofZoneScene, cover: RoofCover): void {
    this.core.pushHistory();

    if (cover === DEFAULT_ROOF_COVER) {
      if (!isNil(zone.labelId)) {
        this.core.buildings = removeRoofZoneLabelFrom(
          this.core.buildings,
          buildingId,
          zone.labelId
        );
      }

      return;
    }

    const position = seedPointOf(zone.polygons, zone.centroid);

    if (isNil(position)) {
      return;
    }

    const label = isNil(zone.labelId)
      ? createRoofZoneLabel({ position, cover })
      : { id: zone.labelId, position, cover };

    this.core.buildings = upsertRoofZoneLabelIn(
      this.core.buildings,
      buildingId,
      zone.storeyId,
      label
    );
  }

  /** The active storey, or the ground one while nothing narrower is aimed at. */
  resolveActiveStoreyId(buildingId: BuildingId): StoreyId | undefined {
    const building = findBuildingIn(this.core.buildings, buildingId);

    return this.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);
  }

  /** The storey the building editor is aimed at; the ground one by default. */
  /** The КОМНАТЫ row under the pointer, read through the store's one access point. */
  get hoveredRoomIndex(): number | undefined {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.hoveredRoomIndex
      : undefined;
  }

  setHoveredRoomIndex(index: number | undefined): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setHoveredRoomIndex(index);
    }
  }

  get activeStoreyId(): StoreyId | undefined {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return undefined;
    }

    if (!isNil(session.activeStoreyId)) {
      return session.activeStoreyId;
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);

    return isNil(building) ? undefined : storeysOf(building)[0].id;
  }

  setActiveStorey(storeyId: StoreyId): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setActiveStoreyId(storeyId);
      this.core.setSelection(undefined);
    }
  }

  /**
   * Which storey the editor is aimed at, counting from one — what the status
   * bar states so «where am I» is answered on the canvas, not only by a chip.
   */
  get activeStoreyOrdinal(): number | undefined {
    const scene = this.editedStoreyScene;

    return isNil(scene) ? undefined : scene.level + 1;
  }

  /** Steps the active storey up or down the stack — the PgUp/PgDn of the editor. */
  stepActiveStorey(direction: 1 | -1): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);

    if (isNil(building)) {
      return;
    }

    const storeys = storeysOf(building);
    const currentLevel = storeys.findIndex(storey => storey.id === this.activeStoreyId);
    const nextLevel = currentLevel + direction;

    if (nextLevel >= 0 && nextLevel < storeys.length) {
      this.setActiveStorey(storeys[nextLevel].id);
    }
  }

  /** The edited building's active storey, resolved against the scenes. */
  get editedStoreyScene(): StoreyScene | undefined {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return undefined;
    }

    const scene = this.scene.buildingScenes.find(
      candidate => candidate.building.id === session.buildingId
    );

    return scene?.storeys.find(storeyScene => storeyScene.storey.id === this.activeStoreyId);
  }

  get isReferenceStoreyVisible(): boolean {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.isReferenceStoreyVisible
      : false;
  }

  toggleReferenceStorey(): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.toggleReferenceStorey();
    }
  }

  /**
   * Raises one more storey over the edited building — empty, or starting from
   * a copy of the storey below's walls (new identities, openings left behind)
   * — and aims the editor at it (`building-editor.md` §5).
   */
  addStoreyToEditedBuilding({
    copyWalls,
    copyOpenings = true,
  }: {
    readonly copyWalls: boolean;
    readonly copyOpenings?: boolean;
  }): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    const building = findBuildingIn(this.core.buildings, session.buildingId);

    if (isNil(building)) {
      return;
    }

    const storeys = storeysOf(building);
    // The ACTIVE storey is the one being copied, not whichever happens to be
    // topmost: «add a floor like this one» is what a typical-floor building
    // asks for, and the active storey is the one on screen.
    const source = storeys.find(candidate => candidate.id === this.activeStoreyId) ?? storeys[0];
    const copiedWalls = copyWalls
      ? source.walls.map(wall => ({ ...wall, id: crypto.randomUUID() as Wall['id'] }))
      : [];
    // Openings ride along with the walls they are hosted on, remapped onto the
    // new wall identities: an upper storey whose outer walls repeat the ones
    // below almost always repeats their windows too, and cutting them again by
    // hand is the click-tax every reference editor spares its users.
    const wallIdByOrigin = new Map(
      source.walls.map((wall, index) => [wall.id, copiedWalls[index]?.id])
    );
    const copiedOpenings =
      copyWalls && copyOpenings
        ? source.openings.flatMap(opening => {
            const wallId = wallIdByOrigin.get(opening.wallId);

            return isNil(wallId)
              ? []
              : [{ ...opening, id: crypto.randomUUID() as Opening['id'], wallId }];
          })
        : [];
    // The floor comes along even with «empty storey»: a storey stands on the
    // one below it, and a new floor with no plates would leave its walls
    // nothing to be held to and nothing to be drawn on.
    const copiedSlabs = slabsOf(source).map(slab => ({ ...slab, id: createShapeId() }));
    const storey = createStorey({
      heightMeters: source.heightMeters,
      walls: copiedWalls,
      openings: copiedOpenings,
      slabs: copiedSlabs,
    });

    this.core.pushHistory();
    this.core.buildings = addStoreyIn(this.core.buildings, session.buildingId, storey);
    this.setActiveStorey(storey.id);
  }

  /** Takes an upper storey down; the ground one is refused by the domain edit. */
  removeStoreyFromEdited(storeyId: StoreyId): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = removeStoreyFrom(this.core.buildings, session.buildingId, storeyId);

    const building = findBuildingIn(this.core.buildings, session.buildingId);

    if (!isNil(building) && this.activeStoreyId === storeyId) {
      this.setActiveStorey(storeysOf(building)[0].id);
    }
  }

  /** Types one storey's height; a keystroke burst stays one undo step. */
  setStoreyHeightOnEdited(storeyId: StoreyId, heightMeters: Meters): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return;
    }

    this.core.pushHistory(`${STOREY_HEIGHT_HISTORY_GROUP}:${storeyId}`);
    this.core.buildings = updateStoreyHeightIn(
      this.core.buildings,
      session.buildingId,
      storeyId,
      heightMeters
    );
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
}
