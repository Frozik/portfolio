import { cn } from '@frozik/components/components/cn';
import type { ReactNode } from 'react';
import { memo } from 'react';

/**
 * The shape every row of the planner's panels takes: the caption on the left,
 * the control or the readout on the right. Both sides may shrink to nothing, so
 * a long caption in a narrow column gives way instead of pushing its control out
 * of the card — the panels are 264 px wide on a desktop and narrower in the
 * drawer, and nothing in them is allowed to overflow that.
 *
 * The control keeps a width of its own rather than taking whatever the caption
 * leaves: `w-28` holds eleven monospace digits, which is the longest reading the
 * plan has — a coordinate to four decimals, signed.
 */
export const PropertyRow = memo(
  ({
    label,
    isControlStretched = false,
    children,
  }: {
    readonly label: string;
    readonly isControlStretched?: boolean;
    readonly children: ReactNode;
  }) => (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="min-w-0 truncate text-[11px] text-text-secondary">{label}</span>
      <div
        className={cn('flex min-w-0 justify-end', isControlStretched ? 'flex-1' : 'w-28 shrink-0')}
      >
        {children}
      </div>
    </div>
  )
);

/** A number the panel only reports, in the column its editable twin would sit in. */
export const PropertyValue = memo(
  ({ value, className }: { readonly value: string; readonly className?: string }) => (
    <span className={cn('truncate font-mono text-[11px] text-text', className)}>{value}</span>
  )
);
