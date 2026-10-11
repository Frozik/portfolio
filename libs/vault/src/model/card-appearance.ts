import type { TCardColor } from './card';

/** The palette, in the order the editor offers it. */
export const CARD_COLORS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'violet',
  'pink',
  'slate',
] as const satisfies readonly TCardColor[];
