import { cn } from '@frozik/components/components/cn';
import type { ReactNode } from 'react';
import { memo } from 'react';

/**
 * Guidance in a panel — what to reach for when there is nothing to edit yet. It
 * is deliberately quieter than the values around it: the panels are narrow, and
 * a sentence set as loudly as the numbers reads as the panel's content rather
 * than as a note about it.
 */
export const PanelHint = memo(
  ({ children, className }: { readonly children: ReactNode; readonly className?: string }) => (
    <p className={cn('text-pretty text-[11px] leading-snug text-text-muted', className)}>
      {children}
    </p>
  )
);
