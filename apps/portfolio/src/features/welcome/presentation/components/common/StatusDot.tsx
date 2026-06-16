import { cn } from '@frozik/components/components/cn';
import { memo } from 'react';

const TONE_STYLES = {
  green: 'bg-landing-green text-landing-green',
  accent: 'bg-landing-accent text-landing-accent',
} as const;

const StatusDotComponent = ({
  tone = 'green',
  className,
}: {
  readonly tone?: 'green' | 'accent';
  readonly className?: string;
}) => (
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
