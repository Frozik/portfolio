import { useEffect } from 'react';

import { isEditableEventTarget } from '../../../../shared/lib/isEditableEventTarget';
import type { SitePlannerStore } from '../../application/SitePlannerStore';

const VIEW_MODE_HOTKEY = 'Tab';
const STOREY_UP_HOTKEY = 'PageUp';
const STOREY_DOWN_HOTKEY = 'PageDown';

/**
 * Tab switches between the plan and the 3D view. It lives on the feature shell
 * rather than in the plan's input layer: that one is mounted with the 2D canvas,
 * so a Tab pressed in the 3D view would have had nothing listening for it.
 *
 * Shift+Tab is deliberately left to the browser, so moving focus backwards out
 * of the workspace still works for keyboard users. PageUp/PageDown ride along
 * for the same reason: the storey switcher is a mode-bar chip, and reaching it
 * with the mouse to change floors is the slowest step of a multi-storey edit.
 */
export function useViewModeHotkey(store: SitePlannerStore): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      // Storeys step with the keyboard, the way every reference editor moves
      // between floors — and, like Tab, from either view.
      if (event.key === STOREY_UP_HOTKEY || event.key === STOREY_DOWN_HOTKEY) {
        event.preventDefault();
        store.storeys.stepActiveStorey(event.key === STOREY_UP_HOTKEY ? 1 : -1);

        return;
      }

      if (
        event.key !== VIEW_MODE_HOTKEY ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      store.tooling.toggleViewMode();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);
}
