import type { MouseEvent } from 'react';
import { memo } from 'react';

import { useEventCallback } from 'usehooks-ts';
import styles from '../styles.module.css';

/** The pull tab of the calendar popup; what a press does is up to the owner. */
export const PopupHandle = memo(
  ({ label, onPress }: { readonly label: string; readonly onPress?: () => void }) => {
    // The field keeps focus (and the popover stays open) while the handle is pressed.
    const handleMouseDown = useEventCallback((event: MouseEvent) => {
      event.preventDefault();
    });

    return (
      <button
        type="button"
        tabIndex={-1}
        className={styles.popupHandle}
        aria-label={label}
        onMouseDown={handleMouseDown}
        onClick={onPress}
      />
    );
  }
);
