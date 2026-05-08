import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect } from 'react';

import { useFunction } from './useFunction';

export function usePointerAction(
  action: (pointer: {
    x: number;
    y: number;
    button: number;
    buttons: number;
    // biome-ignore lint/suspicious/noConfusingVoidType: void needed for callbacks with no return
  }) => boolean | undefined | void,
  ref: RefObject<HTMLElement | null> | undefined
) {
  const handlePointerEvent = useFunction((event: PointerEvent) => {
    if (action(getPropsFromEvent(event))) {
      event.preventDefault();
    }
  });

  useEffect(() => {
    const element = ref?.current;

    if (isNil(element)) {
      return;
    }

    element.addEventListener('pointermove', handlePointerEvent as EventListener);
    element.addEventListener('pointerdown', handlePointerEvent as EventListener);
    element.addEventListener('pointerup', handlePointerEvent as EventListener);
    element.addEventListener('pointercancel', handlePointerEvent as EventListener);

    return () => {
      element.removeEventListener('pointermove', handlePointerEvent as EventListener);
      element.removeEventListener('pointerdown', handlePointerEvent as EventListener);
      element.removeEventListener('pointerup', handlePointerEvent as EventListener);
      element.removeEventListener('pointercancel', handlePointerEvent as EventListener);
    };
  }, [handlePointerEvent, ref]);
}

function getPropsFromEvent(event: PointerEvent) {
  const { target, button, buttons, clientX, clientY } = event;

  const { left, top } = (target as HTMLElement).getBoundingClientRect();

  const x = clientX - left;
  const y = clientY - top;

  return { x, y, button, buttons };
}
