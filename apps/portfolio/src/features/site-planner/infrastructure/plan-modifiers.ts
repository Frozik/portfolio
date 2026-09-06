import type { PlanModifiers } from '../domain/view/plan-input';

/** The modifier keys an event carries, as the plan reads them. */
export function toModifiers({
  altKey,
  shiftKey,
}: {
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}): PlanModifiers {
  return { isAltPressed: altKey, isShiftPressed: shiftKey };
}
