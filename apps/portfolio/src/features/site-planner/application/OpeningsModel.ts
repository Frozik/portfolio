import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { BuildingId } from '../domain/model/building';
import type { Opening, OpeningId, OpeningPreset } from '../domain/model/openings';
import { createOpening, DEFAULT_OPENING_PRESET } from '../domain/model/openings';
import type { Selection } from '../domain/model/selection';
import {
  addOpening as addOpeningIn,
  findOpening as findOpeningIn,
  removeOpening as removeOpeningFrom,
  updateOpening as updateOpeningIn,
} from '../domain/model/wall-edits';
import type { WallId } from '../domain/model/walls';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';

const OPENING_HISTORY_GROUP = 'opening';

const NO_SELECTIONS: readonly Selection[] = [];

/** The doors and windows cut into the walls: the armed preset, hanging, sliding and editing them. */
export class OpeningsModel {
  private readonly core: PlanEditorCore;

  constructor(core: PlanEditorCore) {
    this.core = core;

    makeAutoObservable<OpeningsModel, 'core'>(this, { core: false }, { autoBind: true });
  }

  /** The opening the selection names, when it still exists. */
  get selectedOpening(): Opening | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'opening'
      ? undefined
      : findOpeningIn(this.core.buildings, selection.buildingId, selection.openingId);
  }

  /** What the opening tool places next; door until the editor arms another. */
  get armedOpeningPreset(): OpeningPreset {
    return this.core.editorSession?.kind === 'building'
      ? this.core.editorSession.armedOpeningPreset
      : DEFAULT_OPENING_PRESET;
  }

  setArmedOpeningPreset(preset: OpeningPreset): void {
    if (this.core.editorSession?.kind === 'building') {
      this.core.editorSession.setArmedOpeningPreset(preset);
    }
  }

  /**
   * Hangs the armed preset's opening onto the wall at that offset — one step
   * to undo — and hands it over selected.
   */
  addOpeningAt(buildingId: BuildingId, wallId: WallId, offsetMeters: Meters): void {
    const opening = createOpening({ wallId, preset: this.armedOpeningPreset, offsetMeters });

    this.core.pushHistory();
    this.core.buildings = addOpeningIn(this.core.buildings, buildingId, opening);
    this.core.setSelection({ kind: 'opening', buildingId, openingId: opening.id });
  }

  /**
   * Edits an opening field by field. Typed numbers group per opening, so a
   * burst of keystrokes stays one step to undo.
   */
  updateOpeningProperties(
    buildingId: BuildingId,
    openingId: OpeningId,
    changes: Partial<Omit<Opening, 'id' | 'wallId' | 'kind'>>
  ): void {
    this.core.pushHistory(`${OPENING_HISTORY_GROUP}:${openingId}`);
    this.core.buildings = updateOpeningIn(this.core.buildings, buildingId, openingId, changes);
  }

  /** Slides the opening along its wall; the caller announces the history step. */
  moveOpening(buildingId: BuildingId, openingId: OpeningId, offsetMeters: Meters): void {
    this.core.buildings = updateOpeningIn(this.core.buildings, buildingId, openingId, {
      offsetMeters,
    });
  }

  removeOpening(buildingId: BuildingId, openingId: OpeningId): void {
    this.core.pushHistory();
    this.core.buildings = removeOpeningFrom(this.core.buildings, buildingId, openingId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'opening' && selection.openingId === openingId) {
      this.core.selections = NO_SELECTIONS;
    }
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
