import type { Vector2 } from '@frozik/utils/math/vector2';

import type { PlanModifiers } from '../../domain/view/plan-input';
import type { PlanViewport } from '../../domain/view/plan-viewport';
import type { SitePlannerStore } from '../SitePlannerStore';

/**
 * What every interaction strategy is handed: the store to edit through, the
 * live viewport for screen-space hit tests, and the shell's pointer-movement
 * flag — tracked once, in the shell, so a click that only selects writes
 * nothing whichever editor is open.
 */
export interface InteractionContext {
  readonly store: SitePlannerStore;
  readonly getViewport: () => PlanViewport;
  readonly hasPointerMoved: () => boolean;
}

/**
 * The canvas behaviour of one open editor — the seam a future complex editor
 * (the building editor first) plugs into without the shell growing a special
 * case (see `object-editors.md`). The shell consults the active mode's
 * interaction before its own shared handling: a `true` from a pointer or key
 * handler means the event belonged to the editor.
 *
 * One instance lives exactly as long as one editor visit: the shell creates
 * it on entry and drops it with the mode, so in-flight gestures never survive
 * into another mode.
 */
export interface EditorInteraction {
  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean;
  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean;
  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): boolean;
  onPointerCancel(): void;
  /** The whole edit-mode double click; the shell only commits path drafts first. */
  onDoubleClick(planPoint: Vector2, modifiers: PlanModifiers): void;
  onKeyDown(key: string, modifiers: PlanModifiers): boolean;
  /**
   * The Escape ladder's level between the transients and the selection — a
   * sub-selection only this editor knows about (a path's edited point today,
   * a building's selected wall tomorrow). true = the press was spent here.
   */
  onEscapeStep(): boolean;
  hasTransientInteraction(): boolean;
  cancelTransients(): void;
}

export const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace']);
