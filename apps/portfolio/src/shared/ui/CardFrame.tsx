import type { ReactNode } from 'react';
import { memo } from 'react';

import { cn } from '../lib/cn';

type CardFrameProps = {
  readonly children: ReactNode;
  /**
   * Optional hex color for a 6×6 accent dot in the top-right corner. Omit to
   * hide the dot. Inline style is required because the color is runtime-
   * dynamic (e.g. column color picked per column instance).
   */
  readonly accentColor?: string;
  /** Applies the `lift-hover` utility — a 1 px translateY on hover. */
  readonly hoverable?: boolean;
  readonly className?: string;
};

/**
 * Wrapper that decorates its children with the pair of accent corner
 * brackets defined by the `card-corners` utility. Optional accent dot and
 * lift-on-hover behaviour match the `apps/retro/board.jsx` prototype.
 */
const CardFrameComponent = ({ children, accentColor, hoverable, className }: CardFrameProps) => (
  <div
    className={cn(
      'card-corners relative border border-landing-border-soft bg-landing-bg-card',
      hoverable === true && 'lift-hover',
      className
    )}
  >
    {accentColor !== undefined && (
      <span
        aria-hidden="true"
        className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full opacity-60"
        // Accent color is provided dynamically per card instance, so an
        // inline style is unavoidable here (per CLAUDE.md exception).
        style={{ backgroundColor: accentColor }}
      />
    )}
    {children}
  </div>
);

export const CardFrame = memo(CardFrameComponent);
