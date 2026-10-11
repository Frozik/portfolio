import { clamp } from 'lodash-es';

/** Where a key moves the active row of the card list; `null` for a key the list leaves alone. */
export function nextActiveIndex(
  key: string,
  index: number,
  count: number,
  pageSize: number
): number | null {
  if (count === 0) {
    return null;
  }
  const last = count - 1;
  switch (key) {
    case 'ArrowDown':
      return clamp(index + 1, 0, last);
    case 'ArrowUp':
      return clamp(index - 1, 0, last);
    case 'PageDown':
      return clamp(index + pageSize, 0, last);
    case 'PageUp':
      return clamp(index - pageSize, 0, last);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
