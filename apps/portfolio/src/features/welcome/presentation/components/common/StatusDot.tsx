import { memo } from 'react';

import { cn } from '../../../../../shared/lib/cn';

type StatusDotProps = {
  readonly tone?: 'green' | 'accent';
  readonly className?: string;
};

const TONE_STYLES = {
  green: 'bg-landing-green text-landing-green',
  accent: 'bg-landing-accent text-landing-accent',
} as const;

const StatusDotComponent = ({ tone = 'green', className }: StatusDotProps) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor] animate-status-pulse',
      TONE_STYLES[tone],
      className
    )}
  />
);

export const StatusDot = memo(StatusDotComponent);
