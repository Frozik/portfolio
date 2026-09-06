import { findLast, isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { defaultRidgeDegrees } from '../domain/geometry/pitched-roof';
import type { BuildingId } from '../domain/model/building';
import { pitchedRoofOf } from '../domain/model/building';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import type { PitchedRoof } from '../domain/model/roofs';
import { createPitchedRoof } from '../domain/model/roofs';
import {
  removeRoofZoneLabel as removeRoofZoneLabelFrom,
  setPitchedRoof as setPitchedRoofIn,
  upsertRoofZoneLabel as upsertRoofZoneLabelIn,
} from '../domain/model/storey-edits';
import type { RoofCover } from '../domain/model/storeys';
import { createRoofZoneLabel, DEFAULT_ROOF_COVER } from '../domain/model/storeys';
import type { PlanEditorCore } from './editor-core';
import type { PitchedRoofScene } from './roof-scenes';
import type { RoofZoneScene } from './room-scenes';
import type { SceneModel } from './SceneModel';
import { seedPointOf } from './storey-scenes';

const PITCHED_ROOF_HISTORY_GROUP = 'building:roof';

/**
 * What crowns the edited building: the pitched roof and its properties, and
 * the covers pinned onto the flat roof zones a lower storey leaves exposed.
 */
export class RoofModel {
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;

  constructor(core: PlanEditorCore, scene: SceneModel) {
    this.core = core;
    this.scene = scene;

    makeAutoObservable<RoofModel, 'core' | 'scene'>(
      this,
      { core: false, scene: false },
      { autoBind: true }
    );
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

    const building = findBuildingIn(this.core.buildings, session.buildingId);

    if (isNil(building)) {
      return;
    }

    const scene = this.scene.buildingScenes.find(
      candidate => candidate.building.id === session.buildingId
    );
    // The crowned storey: the highest one that exists as built mass — an empty
    // freshly added level has no footprint for a ridge to be guessed from.
    const crowned = findLast(scene?.storeys ?? [], storeyScene => storeyScene.footprint.length > 0);

    this.core.pushHistory();
    // The DOCUMENT decides which way this toggles. Asking the derived scene
    // instead once made «Убрать» add a second roof: over an empty top storey
    // the scene derives no roof even while the building carries one.
    this.core.buildings = setPitchedRoofIn(
      this.core.buildings,
      session.buildingId,
      isNil(pitchedRoofOf(building))
        ? createPitchedRoof({
            ridgeDegrees: isNil(crowned) ? 0 : defaultRidgeDegrees(crowned.footprint),
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

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
