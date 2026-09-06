import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { BuildingId } from '../domain/model/building';
import { storeysOf } from '../domain/model/building';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import type { BuildingWarning } from '../domain/model/building-warnings';
import type { Opening } from '../domain/model/openings';
import { createShapeId } from '../domain/model/shapes';
import {
  addStorey as addStoreyIn,
  removeStorey as removeStoreyFrom,
  updateStoreyHeight as updateStoreyHeightIn,
} from '../domain/model/storey-edits';
import type { StoreyId } from '../domain/model/storeys';
import { createStorey, slabsOf } from '../domain/model/storeys';
import type { Wall } from '../domain/model/walls';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';
import type { SceneModel } from './SceneModel';
import type { StoreyScene } from './storey-scenes';

const STOREY_HEIGHT_HISTORY_GROUP = 'building:storey-height';

/**
 * The storey stack of the edited building: which level the editor is aimed
 * at, stepping through the stack, raising and taking down storeys, and the
 * active storey read back from the scene with everything resolved on it.
 */
export class StoreysModel {
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;

  constructor(core: PlanEditorCore, scene: SceneModel) {
    this.core = core;
    this.scene = scene;

    makeAutoObservable<StoreysModel, 'core' | 'scene'>(
      this,
      { core: false, scene: false },
      { autoBind: true }
    );
  }

  /** The storey the building editor is aimed at; the ground one by default. */
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

  /** The active storey, or the ground one while nothing narrower is aimed at. */
  resolveActiveStoreyId(buildingId: BuildingId): StoreyId | undefined {
    const building = findBuildingIn(this.core.buildings, buildingId);

    return this.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);
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
   * — and aims the editor at it.
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

  /**
   * Answers a finding in the Замечания panel: aims the editor at the storey it
   * belongs to and brings its place into view. A list of findings is only
   * useful if each row is a way to get to the thing it is about.
   */
  revealWarning(warning: BuildingWarning): void {
    this.core.setViewMode('plan');
    this.setActiveStorey(warning.storeyId);
    this.core.view.centreOn(warning.at);
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
