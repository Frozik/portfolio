import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { BuildingId } from '../domain/model/building';
import type { DuctId, VerticalDuct } from '../domain/model/ducts';
import { createDuct } from '../domain/model/ducts';
import type { Fireplace, FireplaceId, FireplaceKind } from '../domain/model/fireplaces';
import { createFireplace } from '../domain/model/fireplaces';
import {
  addStoreyObject,
  findStoreyObject,
  updateStoreyObject,
} from '../domain/model/storey-edits';
import { DUCT_OBJECTS, FIREPLACE_OBJECTS } from '../domain/model/storey-objects';
import type { Meters } from '../domain/units';
import { normalizeTurnDegrees, QUARTER_TURN_DEGREES } from '../domain/units';
import type { PlanEditorCore } from './editor-core';
import type { SceneModel } from './SceneModel';
import { takeStoreyObjectAway } from './storey-object-removal';
import type { StoreysModel } from './StoreysModel';

/**
 * The vertical shafts of the open building (R34, R35): fireplaces with the
 * flues that derive from them, and the ventilation ducts — placed, slid and
 * taken away, with the derived height every shaft comes out at.
 */
export class DuctsModel {
  private readonly core: PlanEditorCore;
  private readonly scene: SceneModel;
  private readonly storeys: StoreysModel;

  constructor(core: PlanEditorCore, scene: SceneModel, storeys: StoreysModel) {
    this.core = core;
    this.scene = scene;
    this.storeys = storeys;

    makeAutoObservable<DuctsModel, 'core' | 'scene' | 'storeys'>(
      this,
      { core: false, scene: false, storeys: false },
      { autoBind: true }
    );
  }

  /**
   * Puts a fireplace where it was clicked (R34). Its flue is DERIVED — it
   * rises behind the firebox, through every storey above and out of the roof
   * at the height СП 7.13130 asks for — so a fireplace dragged across the room
   * takes its chimney with it and nothing has to be re-drawn.
   */
  placeFireplaceAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.storeys.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    const fireplace = createFireplace({ kind: session.armedFireplaceKind, position: planPoint });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      FIREPLACE_OBJECTS,
      fireplace
    );
    this.core.setSelection({
      kind: 'fireplace',
      buildingId: session.buildingId,
      fireplaceId: fireplace.id,
    });
  }

  /** Slides or turns a fireplace; a drag stays one step to undo. */
  moveFireplace(
    buildingId: BuildingId,
    fireplaceId: FireplaceId,
    changes: Partial<Omit<Fireplace, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      FIREPLACE_OBJECTS,
      fireplaceId,
      changes
    );
  }

  /** Turns a fireplace by a quarter — the quick way to aim it into the room. */
  rotateFireplaceByQuarter(buildingId: BuildingId, fireplaceId: FireplaceId): void {
    const fireplace = findStoreyObject(
      this.core.buildings,
      buildingId,
      FIREPLACE_OBJECTS,
      fireplaceId
    );

    if (isNil(fireplace)) {
      return;
    }

    this.core.pushHistory();
    this.moveFireplace(buildingId, fireplaceId, {
      rotationDegrees: normalizeTurnDegrees(fireplace.rotationDegrees + QUARTER_TURN_DEGREES),
    });
  }

  removeFireplaceFrom(buildingId: BuildingId, fireplaceId: FireplaceId): void {
    takeStoreyObjectAway(this.core, 'fireplace', buildingId, fireplaceId);
  }

  /** Plants a ventilation shaft on the active storey (R35). */
  placeDuctAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.storeys.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    const duct = createDuct({ kind: 'vent', position: planPoint });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      DUCT_OBJECTS,
      duct
    );
    this.core.setSelection({ kind: 'duct', buildingId: session.buildingId, ductId: duct.id });
  }

  /**
   * How high a shaft comes out, by its id — the derived number the panels
   * state. A fireplace's flue answers to the fireplace's own id.
   */
  ductTopElevationOf(ductId: string): Meters | undefined {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return undefined;
    }

    return this.scene.buildingScenes
      .find(candidate => candidate.building.id === session.buildingId)
      ?.ducts.find(run => run.duct.id === ductId)?.topElevation;
  }

  /** Which fire the rail's flyout is armed with. */
  get armedFireplaceKind(): FireplaceKind {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedFireplaceKind
      : 'fireplace';
  }

  setArmedFireplaceKind(kind: FireplaceKind): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedFireplaceKind(kind);
    }
  }

  /** Slides a shaft; the drag announced its own history step when it began. */
  moveDuct(
    buildingId: BuildingId,
    ductId: DuctId,
    changes: Partial<Omit<VerticalDuct, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      DUCT_OBJECTS,
      ductId,
      changes
    );
  }

  removeDuctFrom(buildingId: BuildingId, ductId: DuctId): void {
    takeStoreyObjectAway(this.core, 'duct', buildingId, ductId);
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
