import { useEffect } from 'react';

import { isEditableEventTarget } from '../../../../shared/lib/isEditableEventTarget';
import type { SitePlannerStore } from '../../application/SitePlannerStore';

const VIEW_MODE_HOTKEY = 'Tab';

/**
 * Tab switches between the plan and the 3D view. It lives on the feature shell
 * rather than in the plan's input layer: that one is mounted with the 2D canvas,
 * so a Tab pressed in the 3D view would have had nothing listening for it.
 *
 * Shift+Tab is deliberately left to the browser, so moving focus backwards out
 * of the workspace still works for keyboard users.
 */
export function useViewModeHotkey(store: SitePlannerStore): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key !== VIEW_MODE_HOTKEY ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableEventTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      store.toggleViewMode();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);
}
