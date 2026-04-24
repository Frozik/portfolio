import { memo } from 'react';

import { cn } from '../lib/cn';

type SectionNumberProps = {
  readonly number: string;
  readonly label: string;
  readonly withRule?: boolean;
  readonly className?: string;
};

/**
 * Small mono-typed "01 / retro / lobby" section marker used throughout the
 * redesigned Retro feature. Mirrors the `apps/retro/*.jsx` prototype without
 * the larger SectionHead treatment (those are reserved for the landing).
 */
const SectionNumberComponent = ({
  number,
  label,
  withRule = true,
  className,
}: SectionNumberProps) => (
  <div className={cn('flex items-center gap-3.5', className)}>
    <span className="font-mono text-[11px] tracking-[0.1em] text-landing-fg-faint">
      {number} / {label}
    </span>
    {withRule && <span className="section-rule" />}
  </div>
);

export const SectionNumber = memo(SectionNumberComponent);
