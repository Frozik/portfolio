/**
 * Whether an event landed in something the player is typing into.
 *
 * Games capture their keys on `window`, so without this guard a roster name field, a select or any
 * other form control would lose its arrows, space and tab to the battlefield the moment it is
 * focused — the keystroke would be swallowed and `preventDefault`ed before the control saw it.
 */
export function isEditableEventTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
