import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { EditedObjectDescriptor, EditorDoor, EditTarget } from '../domain/model/editor-mode';
import {
  describeEditedObject,
  editedTargetSelection,
  isSiteEditMode,
  VIEW_MODE,
} from '../domain/model/editor-mode';
import { SELECTION_SCOPE } from '../domain/model/selection';
import type { CompositionModel } from './CompositionModel';
import type { PlanEditorCore } from './editor-core';
import { createEditorSession } from './editor-sessions';

/**
 * View or one opened editor (see `modes.md`): the doors in and the way back
 * out, the session an open editor keeps, and what the mode bar names.
 */
export class EditorModesModel {
  private readonly core: PlanEditorCore;
  private readonly composition: CompositionModel;

  constructor(core: PlanEditorCore, composition: CompositionModel) {
    this.core = core;
    this.composition = composition;

    makeAutoObservable<EditorModesModel, 'core' | 'composition'>(
      this,
      { core: false, composition: false },
      { autoBind: true }
    );
  }

  /**
   * Opens one object for deep editing; see `modes.md`. The editor arrives with
   * a fresh session for its transient state; the tool falls back to selection
   * because whatever was armed may not exist in the new mode, and a path
   * target arrives selected — it is the only thing left to point at.
   */
  enterEditMode(target: EditTarget): void {
    this.core.editorSession?.dispose();
    this.core.editorSession = createEditorSession(target);
    this.core.editorMode = { kind: 'edit', target };
    this.core.setSelection(editedTargetSelection(target));
    this.core.setActiveTool('select');

    // Site editing opens aimed at the plot root; «Строение» re-aims it after.
    if (target.kind === 'site') {
      this.composition.setActiveGroup('boundary');
    }
  }

  /**
   * Descends through a selected object's editor door (`editorDoorFor`): the
   * one entry Enter, the double click and the panels' «edit» buttons share. A
   * building door is site editing already aimed at that building.
   */
  openEditorDoor(door: EditorDoor): void {
    this.enterEditMode(door.target);

    if (!isNil(door.aimAt)) {
      this.composition.setActiveGroup(door.aimAt);
    }
  }

  /**
   * Back to viewing. A shape or mark selection belongs to site editing and
   * would name something the view cannot even pick, so it is dropped; a path,
   * tree or car selection is a view-mode citizen and survives the exit.
   */
  exitEditMode(): void {
    this.core.editorSession?.dispose();
    this.core.editorSession = undefined;
    this.core.editorMode = VIEW_MODE;

    // Selections belonging to the closed editor go with it; the ones that
    // live on the plan stay. Filtering the whole list — not just the last
    // one picked — is what makes this right for a multiple selection.
    this.core.setSelections(
      this.core.selections.filter(candidate => SELECTION_SCOPE[candidate.kind] === 'view')
    );
  }

  /** The path session's edited point, read through the store's one access point. */
  get selectedPathPointIndex(): number | undefined {
    return this.core.editorSession?.kind === 'path'
      ? this.core.editorSession.selectedPointIndex
      : undefined;
  }

  setSelectedPathPointIndex(index: number | undefined): void {
    if (this.core.editorSession?.kind === 'path') {
      this.core.editorSession.setSelectedPointIndex(index);
    }
  }

  get hoveredPathSegmentIndex(): number | undefined {
    return this.core.editorSession?.kind === 'path'
      ? this.core.editorSession.hoveredSegmentIndex
      : undefined;
  }

  setHoveredPathSegmentIndex(index: number | undefined): void {
    if (this.core.editorSession?.kind === 'path') {
      this.core.editorSession.setHoveredSegmentIndex(index);
    }
  }

  /** Whether site editing is currently aimed at one of the buildings. */
  get isEditingBuilding(): boolean {
    return (
      isSiteEditMode(this.core.editorMode) && this.composition.activeGroup.owner !== 'boundary'
    );
  }

  /** What the mode bar names as being edited, or nothing while viewing. */
  get editedObject(): EditedObjectDescriptor | undefined {
    return describeEditedObject(this.core.editorMode, {
      activeOwner: this.composition.activeGroup.owner,
      buildings: this.core.buildings,
      paths: this.core.paths,
      utilityRoutes: this.core.utilityRoutes,
    });
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
