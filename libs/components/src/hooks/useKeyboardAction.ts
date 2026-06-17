import { isEmpty, isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect, useMemo } from 'react';

import { useFunction } from './useFunction';

export function useKeyboardAction(
  keyCodes: string | string[] | undefined,
  action: VoidFunction,
  ref?: RefObject<HTMLElement | null>
) {
  const pressedKeys = useMemo(() => new Set<string>(), []);

  const handleKeyDownEvent = useFunction((event: KeyboardEvent) => {
    pressedKeys.add(event.code);

    if (isNil(keyCodes)) {
      return;
    }

    const codes = Array.isArray(keyCodes) ? keyCodes : [keyCodes];

    if (codes.every(code => pressedKeys.has(code))) {
      action();
      event.preventDefault();
    }
  });
  const handleKeyUpEvent = useFunction(({ code }: KeyboardEvent) => void pressedKeys.delete(code));
  // When the window loses focus the matching keyup may never arrive, leaving a
  // key "stuck" as pressed. Reset the held-keys set on blur so the next focus
  // starts clean.
  const handleWindowBlur = useFunction(() => pressedKeys.clear());

  useEffect(() => {
    if (isEmpty(keyCodes)) {
      return;
    }

    const element = ref?.current ?? window;

    element.addEventListener('keydown', handleKeyDownEvent as EventListener);
    element.addEventListener('keyup', handleKeyUpEvent as EventListener);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      element.removeEventListener('keydown', handleKeyDownEvent as EventListener);
      element.removeEventListener('keyup', handleKeyUpEvent as EventListener);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [handleKeyDownEvent, handleKeyUpEvent, handleWindowBlur, keyCodes, ref]);
}
