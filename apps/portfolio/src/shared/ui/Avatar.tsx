import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../lib/cn';

const avatarVariants = cva(
  'inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-overlay text-text font-medium',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-16 w-16 text-lg',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type AvatarProps = VariantProps<typeof avatarVariants> & {
  src?: string;
  alt?: string;
  children?: ReactNode;
  className?: string;
};

export const Avatar = memo(({ src, alt = '', size, children, className }: AvatarProps) => (
  <span className={cn(avatarVariants({ size }), className)}>
    {!isNil(src) ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : children}
  </span>
));

export type { AvatarProps };
