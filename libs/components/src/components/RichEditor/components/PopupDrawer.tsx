import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { memo, useEffect, useState } from 'react';

import { useEventCallback } from 'usehooks-ts';
import styles from '../styles.module.css';

/** How long the drawer stays out after nothing holds it, so a slip of the mouse does not shut it. */
export const POPUP_RETRACT_DELAY_MS = 700;

/** Shows only its handle until the mouse is over it, a tap pins it or the owner holds it out. */
export const PopupDrawer = memo(
  ({
    held,
    children,
  }: {
    /** Stays pulled out whatever the pointer does, e.g. while the keyboard is inside. */
    readonly held: boolean;
    readonly children: ReactNode;
  }) => {
    const [hovered, setHovered] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [lingers, setLingers] = useState(false);
    const isWanted = held || hovered || pinned;

    useEffect(() => {
      if (isWanted) {
        setLingers(true);
        return undefined;
      }

      const timer = setTimeout(() => setLingers(false), POPUP_RETRACT_DELAY_MS);

      return () => clearTimeout(timer);
    }, [isWanted]);

    const handlePointerEnter = useEventCallback((event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        setHovered(true);
      }
    });
    const handlePointerLeave = useEventCallback(() => setHovered(false));

    // A touch never hovers, so its tap has to keep the drawer out.
    const handleClick = useEventCallback(() => {
      if (!hovered) {
        setPinned(true);
      }
    });

    // The field keeps focus (and the popover stays open) while the handle is clicked.
    const handleMouseDown = useEventCallback((event: MouseEvent) => {
      event.preventDefault();
    });

    return (
      <div
        className={styles.popoverDrawer}
        data-expanded={isWanted || lingers || undefined}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        {children}
        <div className={styles.popoverHandle} aria-hidden="true" />
      </div>
    );
  }
);
