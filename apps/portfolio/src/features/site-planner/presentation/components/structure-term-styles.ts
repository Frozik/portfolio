import { cn } from '@frozik/components/components/cn';

/** The classes and sizes the structure tree is drawn with. */
export const ICON_SIZE_PX = 14;

export const CHIP_ICON_SIZE_PX = 10;

/**
 * How far each level of nesting steps in, on top of the row's own `px-1`. The
 * indent stops growing past the last step: the panel is narrow, and the folder
 * rows standing above a term already say where in the tree it sits.
 */
const INDENT_CLASSES = ['', 'pl-4', 'pl-7', 'pl-10'] as const;

export const ACTION_BUTTON_CLASS = cn(
  'flex size-6 shrink-0 items-center justify-center rounded text-text-secondary',
  'transition-colors duration-150 hover:bg-white/10 hover:text-text',
  'disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
);

export const TERM_ROW_CLASS =
  'group/term relative flex items-center gap-0.5 rounded-lg px-1 py-0.5';

export const TERM_LABEL_CLASS = cn(
  'flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
);

/**
 * The tail of a term row floats over the end of the label instead of standing in
 * the row: the panel is 264 px wide, and six buttons abreast left the label with
 * three characters. Reserving no width for them is what keeps the label whole,
 * so the cluster carries a background of its own to cover what it hides.
 */
export const HOVER_ACTIONS_CLASS = cn(
  'absolute top-1/2 right-1 -translate-y-1/2 rounded-lg px-0.5',
  'border border-white/10 bg-surface-overlay shadow-lg',
  'pointer-events-none opacity-0 transition-opacity duration-150',
  'group-hover/term:pointer-events-auto group-hover/term:opacity-100',
  'group-focus-within/term:pointer-events-auto group-focus-within/term:opacity-100'
);

export function indentClass(depth: number): string {
  return INDENT_CLASSES[Math.min(depth, INDENT_CLASSES.length - 1)];
}
