import { useMediaQuery } from 'usehooks-ts';

/** Room for the sections, the list and a card side by side. */
const WIDE_LAYOUT_QUERY = '(min-width: 1024px)';

export function useWideLayout(): boolean {
  return useMediaQuery(WIDE_LAYOUT_QUERY);
}
