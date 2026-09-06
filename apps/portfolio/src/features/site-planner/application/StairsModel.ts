import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { BuildingId } from '../domain/model/building';
import type { StairId, StairInstance, StairKind } from '../domain/model/stairs';
import { createStair, DEFAULT_STAIR_KIND } from '../domain/model/stairs';
import {
  addStoreyObject,
  findStoreyObject,
  updateStoreyObject,
} from '../domain/model/storey-edits';
import { STAIR_OBJECTS } from '../domain/model/storey-objects';
import { normalizeTurnDegrees, QUARTER_TURN_DEGREES } from '../domain/units';
import type { PlanEditorCore } from './editor-core';
import type { StairScene } from './stair-scenes';
import { takeStoreyObjectAway } from './storey-object-removal';
import type { StoreysModel } from './StoreysModel';

/**
 * The stairs of the open building: the armed kind, placing one where it was
 * clicked — its run derived from the storey's floor to floor — and turning,
 * mirroring and taking it away.
 */
export class StairsModel {
  private readonly core: PlanEditorCore;
  private readonly storeys: StoreysModel;

  constructor(core: PlanEditorCore, storeys: StoreysModel) {
    this.core = core;
    this.storeys = storeys;

    makeAutoObservable<StairsModel, 'core' | 'storeys'>(
      this,
      { core: false, storeys: false },
      { autoBind: true }
    );
  }

  /** Which stair the tool will place next — the flyout's armed catalogue row. */
  get armedStairKind(): StairKind {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedStairKind
      : DEFAULT_STAIR_KIND;
  }

  setArmedStairKind(kind: StairKind): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedStairKind(kind);
    }
  }

  /**
   * Puts a stair on the active storey, climbing toward the storey above. It
   * lands where it was clicked, its run derived from that storey's floor to
   * floor — the footprint is an output, so there is nothing to size by hand.
   */
  placeStairAt(planPoint: Vector2): void {
    const session = this.core.editorSession;
    const storeyId = this.storeys.activeStoreyId;

    if (session?.kind !== 'building' || isNil(storeyId)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = addStoreyObject(
      this.core.buildings,
      session.buildingId,
      storeyId,
      STAIR_OBJECTS,
      createStair({ kind: session.armedStairKind, position: planPoint })
    );
  }

  /** Slides or turns a stair; a drag stays one step to undo, like furniture. */
  moveStair(
    buildingId: BuildingId,
    stairId: StairId,
    changes: Partial<Omit<StairInstance, 'id' | 'kind'>>
  ): void {
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      STAIR_OBJECTS,
      stairId,
      changes
    );
  }

  /**
   * Turns a stair by a quarter — the quick way to aim it along a wall. The
   * grip is for the odd angle; this is for the four that a room actually
   * wants, and it takes one click rather than an aimed drag.
   */
  rotateStairByQuarter(buildingId: BuildingId, stairId: StairId): void {
    const stair = findStoreyObject(this.core.buildings, buildingId, STAIR_OBJECTS, stairId);

    if (isNil(stair)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      STAIR_OBJECTS,
      stairId,
      {
        rotationDegrees: normalizeTurnDegrees(stair.rotationDegrees + QUARTER_TURN_DEGREES),
      }
    );
  }

  /** Flips a stair to its other hand — the mirrored plan of the same stair. */
  mirrorStair(buildingId: BuildingId, stairId: StairId): void {
    const stair = findStoreyObject(this.core.buildings, buildingId, STAIR_OBJECTS, stairId);

    if (isNil(stair)) {
      return;
    }

    this.core.pushHistory();
    this.core.buildings = updateStoreyObject(
      this.core.buildings,
      buildingId,
      STAIR_OBJECTS,
      stairId,
      {
        isMirrored: stair.isMirrored !== true,
      }
    );
  }

  removeStairFrom(buildingId: BuildingId, stairId: StairId): void {
    takeStoreyObjectAway(this.core, 'stair', buildingId, stairId);
  }

  /** The selected stair, resolved against the active storey's scene. */
  get selectedStairScene(): StairScene | undefined {
    const { selection } = this.core;

    return selection?.kind === 'stair'
      ? this.storeys.editedStoreyScene?.stairs.find(
          stairScene => stairScene.stair.id === selection.stairId
        )
      : undefined;
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
