import { isNil } from 'lodash-es';
import { editorDoorFor, editorToolForHotkey, isToolAllowed } from '../../domain/model/editor-mode';
import type { PlanTool } from '../../domain/model/selection';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { SitePlannerStore } from '../SitePlannerStore';
import type { EditorInteraction } from './editor-interaction';
import { DELETE_KEYS } from './editor-interaction';

export const TOOL_HOTKEYS: Readonly<Record<string, PlanTool | undefined>> = {
  v: 'select',
  h: 'pan',
  r: 'rectangle',
  c: 'circle',
  i: 'ellipse',
  e: 'elevation',
  t: 'tree',
  p: 'path',
  n: 'utility',
  m: 'measure',
};

const CANCEL_KEY = 'Escape';

/**
 * Figma's habit: Enter descends into the selected object's editor, Escape
 * climbs back out. Tab is taken — it flips the plan and the 3D view.
 */
const ENTER_MODE_KEY = 'Enter';

/** Finishes the polyline of a path, as the double click does. */
const COMMIT_KEY = 'Enter';

/** What the keyboard needs from the controller: the open editor, and the gestures in flight. */
export interface KeyboardCommandHost {
  currentEditInteraction(): EditorInteraction | undefined;
  hasActiveViewGesture(): boolean;
  onPointerCancel(): void;
}

/**
 * The keys every mode shares: the tool hotkeys, Enter to commit a drawn
 * polyline or descend into the selection's editor, Delete, and the Escape
 * ladder — one level per press, nothing committed is lost.
 */
export class PlanKeyboardCommands {
  private readonly store: SitePlannerStore;
  private readonly host: KeyboardCommandHost;

  constructor(store: SitePlannerStore, host: KeyboardCommandHost) {
    this.store = store;
    this.host = host;
  }

  onKeyDown(key: string, modifiers: PlanModifiers): boolean {
    // The wall-junction break UI owns the keyboard while a junction is
    // selected: its `s`/`d`/digits would otherwise arm the stair and duct
    // tools before the interaction ever saw them.
    if (!isNil(this.store.walls.selectedJunction)) {
      const editInteraction = this.host.currentEditInteraction();

      if (!isNil(editInteraction) && editInteraction.onKeyDown(key, modifiers)) {
        return true;
      }
    }

    const tool = TOOL_HOTKEYS[key.toLowerCase()];

    if (!isNil(tool)) {
      if (!isToolAllowed(this.store.editorMode, tool)) {
        return false;
      }

      this.host.onPointerCancel();
      this.store.setActiveTool(tool);

      return true;
    }

    const editorTool = editorToolForHotkey(this.store.editorMode, key.toLowerCase());

    if (!isNil(editorTool)) {
      this.host.onPointerCancel();
      this.store.setActiveTool(editorTool);

      return true;
    }

    if (key === CANCEL_KEY) {
      this.cancelOneLevel();

      return true;
    }

    if (key === COMMIT_KEY && this.store.siteObjects.draftPathPoints.length > 0) {
      this.store.siteObjects.commitDraftPath();

      return true;
    }

    if (key === COMMIT_KEY && this.store.utilities.draftUtilityPoints.length > 0) {
      this.store.utilities.commitDraftUtilityRoute();

      return true;
    }

    const interaction = this.host.currentEditInteraction();

    if (!isNil(interaction) && interaction.onKeyDown(key, modifiers)) {
      return true;
    }

    if (key === ENTER_MODE_KEY) {
      return this.enterSelectionEditMode();
    }

    if (DELETE_KEYS.has(key)) {
      // An open editor already took its own Delete above (a path's point);
      // what is left is the selected whole object, in any mode.
      this.store.selectionCommands.removeSelected();

      return true;
    }

    return false;
  }

  /**
   * The Escape ladder — one level per press, nothing committed is lost: the
   * gesture or draft in flight, then the editor's own sub-selection, then the
   * selection, and only from a quiet editor the mode itself.
   */
  private cancelOneLevel(): void {
    if (this.hasTransientInteraction()) {
      this.cancelTransients();

      return;
    }

    const interaction = this.host.currentEditInteraction();

    if (!isNil(interaction) && interaction.onEscapeStep()) {
      return;
    }

    if (!isNil(this.store.selection)) {
      this.store.setSelection(undefined);

      return;
    }

    if (this.store.editorMode.kind === 'edit') {
      this.store.exitEditMode();
    }
  }

  private hasTransientInteraction(): boolean {
    const interaction = this.host.currentEditInteraction();

    return (
      (!isNil(interaction) && interaction.hasTransientInteraction()) ||
      this.host.hasActiveViewGesture() ||
      this.store.siteObjects.draftPathPoints.length > 0 ||
      this.store.utilities.draftUtilityPoints.length > 0 ||
      this.store.measurePoints.length > 0
    );
  }

  cancelTransients(): void {
    this.host.onPointerCancel();
    this.host.currentEditInteraction()?.cancelTransients();
    this.store.tooling.setMeasurePoints([]);
    this.store.siteObjects.cancelDraftPath();
    this.store.utilities.cancelDraftUtilityRoute();
  }

  /** Enter descends into the selected object's editor, when it has one. */
  private enterSelectionEditMode(): boolean {
    const { editorMode, selection } = this.store;

    if (editorMode.kind !== 'view' || isNil(selection)) {
      return false;
    }

    const door = editorDoorFor(selection);

    if (isNil(door)) {
      return false;
    }

    this.cancelTransients();
    this.store.modes.openEditorDoor(door);

    return true;
  }
}
