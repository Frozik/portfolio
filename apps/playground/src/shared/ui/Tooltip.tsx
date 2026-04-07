import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../lib/cn';

type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  title: ReactNode;
  placement?: TooltipPlacement;
  children: ReactNode;
  className?: string;
};

export const Tooltip = memo(({ title, placement = 'top', children, className }: TooltipProps) => (
  <TooltipPrimitive.Provider delayDuration={200}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={placement}
          sideOffset={4}
          className={cn(
            'z-50 rounded-md bg-surface-overlay px-3 py-1.5 text-sm text-text shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            className
          )}
        >
          {title}
          <TooltipPrimitive.Arrow className="fill-surface-overlay" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>
));

export type { TooltipPlacement, TooltipProps };
