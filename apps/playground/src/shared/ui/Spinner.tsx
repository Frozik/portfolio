import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { memo } from 'react';
import { cn } from '../lib/cn';

const spinnerVariants = cva(
  'animate-spin rounded-full border-solid border-brand-500 border-t-transparent',
  {
    variants: {
      size: {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-3',
        lg: 'h-12 w-12 border-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type SpinnerProps = VariantProps<typeof spinnerVariants> & {
  className?: string;
};

export const Spinner = memo(({ size, className }: SpinnerProps) => (
  <div className={cn('flex items-center justify-center', className)} role="status">
    <div className={cn(spinnerVariants({ size }))} />
    <span className="sr-only">Loading...</span>
  </div>
));

export type { SpinnerProps };
