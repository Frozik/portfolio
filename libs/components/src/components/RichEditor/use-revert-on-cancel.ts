import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

/**
 * The family's Escape contract: the value from when the
 * field took focus is put back. Remembers it on focus; `cancel` emits it if
 * the value has changed since.
 */
export function useRevertOnCancel<T>(
  value: T,
  onValueChange: ((value: T) => void) | undefined
): { readonly rememberOnFocus: (focused: boolean) => void; readonly cancel: () => void } {
  const valueBeforeEditRef = useRef(value);
  const rememberOnFocus = useEventCallback((focused: boolean) => {
    if (focused) {
      valueBeforeEditRef.current = value;
    }
  });
  const cancel = useEventCallback(() => {
    if (!Object.is(valueBeforeEditRef.current, value)) {
      onValueChange?.(valueBeforeEditRef.current);
    }
  });
  return { rememberOnFocus, cancel };
}
