import type { Vector2 } from '@frozik/utils/math/vector2';

/**
 * The modifier keys the plan editor gives meaning to: `Alt` suspends snapping
 * for the duration of a gesture, `Shift` coarsens the rotation step and the
 * keyboard nudge.
 */
export interface PlanModifiers {
  readonly isAltPressed: boolean;
  readonly isShiftPressed: boolean;
}

export const NO_MODIFIERS: PlanModifiers = { isAltPressed: false, isShiftPressed: false };

/**
 * The port the DOM input layer drives. Points arrive already converted to plan
 * metres, which is what keeps the interaction logic testable with no canvas and
 * no synthetic events.
 */
export interface PlanInputTarget {
  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): void;
  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): void;
  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): void;
  /** The gesture was interrupted (OS cancel, focus loss): drop it without committing. */
  onPointerCancel(): void;
  onPointerLeave(): void;
  /**
   * The second click of a double click, after both its presses have already been
   * reported. The point names what was double-clicked — a path's point handle
   * answers it — while the presses themselves have already done their selecting.
   * Modifiers ride along: Alt turns a wall point's removal into a cut.
   */
  onDoubleClick(planPoint: Vector2, modifiers: PlanModifiers): void;
  /** Reports whether the key was consumed, so the caller can suppress the browser default. */
  onKeyDown(key: string, modifiers: PlanModifiers): boolean;
  /**
   * The undo and redo chords. They arrive as their own calls rather than
   * through {@link PlanInputTarget.onKeyDown}: which keys spell "undo" is
   * knowledge of the platform's keyboard, and it belongs with the DOM layer that
   * already tells a chord from a plain key.
   */
  onUndo(): void;
  onRedo(): void;
  /** The duplicate chord, claimed with the history ones for the same reason. */
  duplicateSelected(): void;
}
