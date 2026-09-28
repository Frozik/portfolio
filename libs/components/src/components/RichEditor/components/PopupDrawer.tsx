import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { memo, useState } from 'react';

import { useEventCallback } from 'usehooks-ts';
import styles from '../styles.module.css';

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
        data-expanded={held || hovered || pinned || undefined}
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
