import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { isEditableEventTarget } from '../../../shared/lib/isEditableEventTarget';
import type { PlanInputTarget } from '../domain/view/plan-input';
import { toModifiers } from './plan-modifiers';

const SPACE_KEY = ' ';
const UNDO_KEY = 'z';
/** The Windows redo chord; macOS spells the same thing Cmd+Shift+Z. */
const REDO_KEY = 'y';
const DUPLICATE_KEY = 'd';

type HistoryAction = 'undo' | 'redo';

/**
 * Controls that answer Space themselves. Space is the pan modifier of the
 * canvas, but a focused toolbar button — a tool, the export menu — must still be
 * activated by it rather than have the keystroke taken for the camera.
 */
const ACTIVATABLE_CONTROL_SELECTOR = 'button, [role="button"], a[href]';

/**
 * The editor's keyboard: the history chords, Ctrl/Cmd+D, the Space pan modifier
 * and the plain hotkeys the interaction target answers. Returns the unbind.
 */
export function attachPlanKeyboardInput({
  target,
  setSpaceHeld,
}: {
  readonly target: PlanInputTarget;
  /** Space is the pan modifier of the canvas; the pointer layer owns what it does. */
  readonly setSpaceHeld: (isHeld: boolean) => void;
}): VoidFunction {
  const handleKeyDown = (event: KeyboardEvent): void => {
    // A hotkey must never fire while the user is typing exact dimensions into
    // the properties panel — including undo, which there means the text editor's.
    if (isEditableEventTarget(event.target)) {
      return;
    }

    const historyAction = toHistoryAction(event);

    if (!isNil(historyAction)) {
      applyHistoryAction(target, historyAction);
      event.preventDefault();

      return;
    }

    // Duplicate rides the same chord as everywhere else. It is claimed here,
    // beside undo, because the plain-key path below deliberately ignores
    // chords — and because Alt is already «suspend snapping» in this editor,
    // so the market's Alt+drag copy has no room.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === DUPLICATE_KEY) {
      target.duplicateSelected();
      event.preventDefault();

      return;
    }

    // Every other chord belongs to the browser and to the app shell.
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === SPACE_KEY) {
      if (isActivatableControl(event.target)) {
        return;
      }

      setSpaceHeld(true);
      event.preventDefault();

      return;
    }

    if (target.onKeyDown(event.key, toModifiers(event))) {
      event.preventDefault();
    }
  };

  // Not guarded by the typing check: a keyup missed because focus moved into an
  // input would leave the canvas stuck in pan mode.
  const handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === SPACE_KEY) {
      setSpaceHeld(false);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}

function toHistoryAction(event: KeyboardEvent): HistoryAction | undefined {
  if (!event.ctrlKey && !event.metaKey) {
    return undefined;
  }

  const key = event.key.toLowerCase();

  if (key === REDO_KEY) {
    return 'redo';
  }

  if (key !== UNDO_KEY) {
    return undefined;
  }

  return event.shiftKey ? 'redo' : 'undo';
}

function applyHistoryAction(target: PlanInputTarget, action: HistoryAction): void {
  switch (action) {
    case 'undo':
      target.onUndo();

      return;
    case 'redo':
      target.onRedo();

      return;
    default:
      assertNever(action);
  }
}

function isActivatableControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !isNil(target.closest(ACTIVATABLE_CONTROL_SELECTOR));
}
