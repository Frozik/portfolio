import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { BuildingId } from '../domain/model/building';
import { storeysOf } from '../domain/model/building';
import { findBuilding as findBuildingIn } from '../domain/model/building-edits';
import type { FurnitureCatalogId, FurnitureId, FurnitureInstance } from '../domain/model/furniture';
import { createFurniture, DEFAULT_FURNITURE_CATALOG_ID } from '../domain/model/furniture';
import {
  addStoreyObject,
  findStoreyObject,
  updateStoreyObject,
} from '../domain/model/storey-edits';
import { FURNITURE_OBJECTS } from '../domain/model/storey-objects';
import type { PlanEditorCore } from './editor-core';
import { takeStoreyObjectAway } from './storey-object-removal';
import type { StoreysModel } from './StoreysModel';

const FURNITURE_HISTORY_GROUP = 'furniture';

/** The furnishings of the open building: the armed catalogue piece, placing, dragging and editing it. */
export class FurnitureModel {
  private readonly core: PlanEditorCore;
  private readonly storeys: StoreysModel;

  constructor(core: PlanEditorCore, storeys: StoreysModel) {
    this.core = core;
    this.storeys = storeys;

    makeAutoObservable<FurnitureModel, 'core' | 'storeys'>(
      this,
      { core: false, storeys: false },
      { autoBind: true }
    );
  }

  /** The furniture the selection names, when it still exists. */
  get selectedFurniture(): FurnitureInstance | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'furniture'
      ? undefined
      : findStoreyObject(
          this.core.buildings,
          selection.buildingId,
          FURNITURE_OBJECTS,
          selection.furnitureId
        );
  }

  /** What the furniture tool places next, chosen in the МЕБЕЛЬ panel. */
  get armedFurnitureId(): FurnitureCatalogId {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedFurnitureId
      : DEFAULT_FURNITURE_CATALOG_ID;
  }

  setArmedFurnitureId(catalogId: FurnitureCatalogId): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedFurnitureId(catalogId);
    }
  }

  /** Places the armed piece on the active storey — one step to undo, selected. */
  placeFurnitureAt(buildingId: BuildingId, position: Vector2): void {
    const building = findBuildingIn(this.core.buildings, buildingId);
    const storeyId =
      this.storeys.activeStoreyId ?? (isNil(building) ? undefined : storeysOf(building)[0].id);

    if (isNil(storeyId)) {
      return;
    }

    const furniture = createFurniture({ catalogId: this.armedFurnitureId, position });

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      buildingId,
      storeyId,
      FURNITURE_OBJECTS,
      furniture
    );
    this.core.setSelection({ kind: 'furniture', buildingId, furnitureId: furniture.id });
  }

  /**
   * Edits a piece field by field. Typed numbers group per piece, so a burst
   * of keystrokes stays one step to undo.
   */
  updateFurnitureProperties(
    buildingId: BuildingId,
    furnitureId: FurnitureId,
    changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
  ): void {
    this.core.pushHistory(`${FURNITURE_HISTORY_GROUP}:${furnitureId}`);
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      FURNITURE_OBJECTS,
      furnitureId,
      changes
    );
  }

  /** Follows the pointer; the caller announces the history step it belongs to. */
  moveFurniture(
    buildingId: BuildingId,
    furnitureId: FurnitureId,
    changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      FURNITURE_OBJECTS,
      furnitureId,
      changes
    );
  }

  removeFurniture(buildingId: BuildingId, furnitureId: FurnitureId): void {
    takeStoreyObjectAway(this.core, 'furniture', buildingId, furnitureId);
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
