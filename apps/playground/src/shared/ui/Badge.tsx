import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../lib/cn';

const COLOR_MAP: Record<string, string> = {
  green: 'bg-success',
  red: 'bg-error',
  blue: 'bg-info',
  orange: 'bg-warning',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
  gold: 'bg-yellow-500',
};

type BadgeProps = {
  count?: number;
  overflowCount?: number;
  color?: string;
  dot?: boolean;
  children?: ReactNode;
  className?: string;
};

const DEFAULT_OVERFLOW_COUNT = 99;

export const Badge = memo(
  ({
    count,
    overflowCount = DEFAULT_OVERFLOW_COUNT,
    color = 'red',
    dot = false,
    children,
    className,
  }: BadgeProps) => {
    const colorClass = COLOR_MAP[color] ?? 'bg-error';
    const displayCount = !isNil(count) && count > overflowCount ? `${overflowCount}+` : count;
    const showBadge = dot || !isNil(count);

    return (
      <span className={cn('relative inline-flex', className)}>
        {children}
        {showBadge && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white text-xs font-medium',
              colorClass,
              dot ? 'h-2 w-2' : 'min-w-5 h-5 px-1.5'
            )}
          >
            {!dot && displayCount}
          </span>
        )}
      </span>
    );
  }
);

export type { BadgeProps };
