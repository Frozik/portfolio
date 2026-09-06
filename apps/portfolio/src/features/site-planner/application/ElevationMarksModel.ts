import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { ElevationMarkDraft } from '../domain/model/parse-elevation-csv';
import type { Selection } from '../domain/model/selection';
import {
  addMark,
  moveMark,
  removeMark,
  setMarkElevation as setMarkElevationIn,
} from '../domain/model/site-object-edits';
import type { ElevationMark, MarkId } from '../domain/model/site-plan';
import { createElevationMark } from '../domain/model/site-plan';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';

const NO_SELECTIONS: readonly Selection[] = [];
const NEW_MARK_ELEVATION_METERS: Meters = 0;

function findMark(marks: readonly ElevationMark[], markId: MarkId): ElevationMark | undefined {
  return marks.find(mark => mark.id === markId);
}

/**
 * What stands on the plot outside the buildings: elevation marks, trees, cars
 * and paths, plus the placement tool that drops the armed object. Owns the
 * path draft and the placement arming; the committed objects live in the
 * document (the core).
 */
/**
 * The surveyed elevation marks: placing them, typing their heights into the
 * field that floats by the flag, and pasting a batch from a CSV.
 */
export class ElevationMarksModel {
  /** The mark whose elevation is being typed into the field floating by its flag. */
  elevationInputMarkId: MarkId | undefined = undefined;

  private readonly core: PlanEditorCore;

  constructor(core: PlanEditorCore) {
    this.core = core;

    makeAutoObservable<ElevationMarksModel, 'core'>(this, { core: false }, { autoBind: true });
  }

  get selectedMark(): ElevationMark | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'mark'
      ? undefined
      : findMark(this.core.elevationMarks, selection.markId);
  }

  /** The mark the floating elevation field belongs to, or nothing while it is closed. */
  get elevationInputMark(): ElevationMark | undefined {
    const { elevationInputMarkId } = this;

    return isNil(elevationInputMarkId)
      ? undefined
      : findMark(this.core.elevationMarks, elevationInputMarkId);
  }

  /**
   * Places a mark and hands it straight to the user: it becomes the selection,
   * and the field by its flag opens so the surveyed elevation can be typed
   * without a trip to the properties panel.
   */
  addElevationMark(position: Vector2): ElevationMark {
    const mark = createElevationMark({ position, elevation: NEW_MARK_ELEVATION_METERS });

    this.core.pushHistory();
    this.core.elevationMarks = addMark(this.core.elevationMarks, mark);
    this.core.selections = [{ kind: 'mark', markId: mark.id }];
    this.elevationInputMarkId = mark.id;

    return mark;
  }

  /** A pasted batch lands as one step: the paste is what the user would undo. */
  addElevationMarks(drafts: readonly ElevationMarkDraft[]): void {
    if (drafts.length === 0) {
      return;
    }

    this.core.pushHistory();
    this.core.elevationMarks = [...this.core.elevationMarks, ...drafts.map(createElevationMark)];
  }

  moveElevationMark(markId: MarkId, position: Vector2): void {
    this.core.elevationMarks = moveMark(this.core.elevationMarks, markId, position);
  }

  setElevationMarkElevation(markId: MarkId, elevation: Meters): void {
    this.core.elevationMarks = setMarkElevationIn(this.core.elevationMarks, markId, elevation);
  }

  removeElevationMark(markId: MarkId): void {
    this.core.pushHistory();
    this.core.elevationMarks = removeMark(this.core.elevationMarks, markId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'mark' && selection.markId === markId) {
      this.core.selections = NO_SELECTIONS;
    }

    if (this.elevationInputMarkId === markId) {
      this.elevationInputMarkId = undefined;
    }
  }

  closeElevationInput(): void {
    this.elevationInputMarkId = undefined;
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
