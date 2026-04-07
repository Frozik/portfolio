import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect } from 'react';

import { useFunction } from './useFunction';

export function useMouseAction(
  action: (mouse: {
    x: number;
    y: number;
    button: number;
    buttons: number;
    // biome-ignore lint/suspicious/noConfusingVoidType: void needed for callbacks with no return
  }) => boolean | undefined | void,
  ref: RefObject<HTMLElement | null> | undefined
) {
  const handleMouseEvent = useFunction((event: MouseEvent) => {
    if (action(getPropsFromEvent(event))) {
      event.preventDefault();
    }
  });

  useEffect(() => {
    const element = ref?.current;

    if (isNil(element)) {
      return;
    }

    element.addEventListener('mousemove', handleMouseEvent as EventListener);
    element.addEventListener('mousedown', handleMouseEvent as EventListener);
    element.addEventListener('mouseup', handleMouseEvent as EventListener);

    return () => {
      element.removeEventListener('mousemove', handleMouseEvent as EventListener);
      element.removeEventListener('mousedown', handleMouseEvent as EventListener);
      element.removeEventListener('mouseup', handleMouseEvent as EventListener);
    };
  }, [handleMouseEvent, ref]);
}

function getPropsFromEvent(event: MouseEvent) {
  const { target, button, buttons, clientX, clientY } = event;

  const { left, top } = (target as HTMLElement).getBoundingClientRect();

  const x = clientX - left;
  const y = clientY - top;

  return { x, y, button, buttons };
}
