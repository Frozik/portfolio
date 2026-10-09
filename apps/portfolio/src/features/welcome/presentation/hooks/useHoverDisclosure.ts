import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback, useEventListener } from 'usehooks-ts';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 200;
const MOUSE = 'mouse';

export function useHoverDisclosure(rootRef: RefObject<HTMLElement | null>) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const settle = useEventCallback((open: boolean, delayMs: number) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(open), delayMs);
  });
  const close = useEventCallback(() => {
    clearTimeout(timerRef.current);
    setIsOpen(false);
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEventListener('pointerdown', event => {
    const isInside = event.target instanceof Node && rootRef.current?.contains(event.target);
    if (isOpen && isInside !== true) {
      close();
    }
  });
  useEventListener('keydown', event => {
    if (isOpen && event.key === 'Escape') {
      close();
    }
  });

  const onPointerEnter = useEventCallback((event: ReactPointerEvent) => {
    if (event.pointerType === MOUSE) {
      settle(true, OPEN_DELAY_MS);
    }
  });
  const onPointerLeave = useEventCallback((event: ReactPointerEvent) => {
    if (event.pointerType === MOUSE) {
      settle(false, CLOSE_DELAY_MS);
    }
  });
  // A mouse has already opened the panel by hovering, so its click must not close it again.
  const onClick = useEventCallback((event: ReactMouseEvent) => {
    clearTimeout(timerRef.current);
    const isMouse = 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType === MOUSE;
    setIsOpen(open => isMouse || !open);
  });

  return { isOpen, onPointerEnter, onPointerLeave, onClick };
}
