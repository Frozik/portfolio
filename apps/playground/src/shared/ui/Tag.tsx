import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../lib/cn';

const TAG_COLOR_MAP: Record<string, string> = {
  green: 'border-success/40 bg-success/15 text-success',
  red: 'border-error/40 bg-error/15 text-error',
  blue: 'border-info/40 bg-info/15 text-info',
  orange: 'border-warning/40 bg-warning/15 text-warning',
  purple: 'border-purple-500/40 bg-purple-500/15 text-purple-400',
  cyan: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-400',
  gold: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-400',
  magenta: 'border-pink-500/40 bg-pink-500/15 text-pink-400',
  geekblue: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-400',
  lime: 'border-lime-500/40 bg-lime-500/15 text-lime-400',
};

const DEFAULT_TAG_STYLE = 'border-border bg-surface-elevated text-text';

const tagVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium'
);

type TagProps = VariantProps<typeof tagVariants> & {
  color?: string;
  children?: ReactNode;
  className?: string;
};

export const Tag = memo(({ color, children, className }: TagProps) => {
  const colorClasses = color ? (TAG_COLOR_MAP[color] ?? DEFAULT_TAG_STYLE) : DEFAULT_TAG_STYLE;

  return <span className={cn(tagVariants(), colorClasses, className)}>{children}</span>;
});

export type { TagProps };
