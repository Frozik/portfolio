/**
 * A table with a panel beside it. On a narrow screen the panel goes above
 * the table, which then gets the full width; the panel keeps to a share of
 * the height and scrolls inside it. The table comes first in the markup.
 */
export const SPLIT_CLASS = 'flex min-h-0 flex-1 flex-col-reverse gap-3 md:flex-row md:gap-4';
export const SIDE_PANEL_CLASS =
  'max-h-[35%] w-full shrink-0 overflow-y-auto md:max-h-none md:w-64 md:overflow-visible';
