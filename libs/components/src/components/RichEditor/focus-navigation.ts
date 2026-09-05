import { isNil } from 'lodash-es';
import type { FocusableElement } from 'tabbable';
import { tabbable } from 'tabbable';

/** The element after `anchor` in tab order, wrapping around; `undefined` when `anchor` is alone. */
export function findNextTabStop(anchor: HTMLElement): FocusableElement | undefined {
  const stops = tabbable(document.body);
  const index = stops.indexOf(anchor);
  const next = stops[index + 1] ?? stops[0];

  return isNil(next) || next === anchor ? undefined : next;
}
