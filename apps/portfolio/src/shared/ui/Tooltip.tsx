import { cn } from '@frozik/components/components/cn';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { memo } from 'react';

type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

const DEFAULT_DELAY_MS = 200;

/**
 * Single Radix tooltip provider for the whole app. Mounted once near the app
 * root (see Application) so every Tooltip shares one provider instead of
 * spinning up its own — per-instance delays are still honoured because each
 * Tooltip's Root overrides `delayDuration`.
 */
export const TooltipProvider = memo(({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={DEFAULT_DELAY_MS}>{children}</TooltipPrimitive.Provider>
));

export const Tooltip = memo(
  ({
    title,
    placement = 'top',
    children,
    className,
    open,
    delayDuration = DEFAULT_DELAY_MS,
  }: {
    title: ReactNode;
    placement?: TooltipPlacement;
    children: ReactNode;
    className?: string;
    /**
     * Controlled open state. When provided, the tooltip ignores hover/focus
     * triggers and is shown/hidden based on this value. Use `true` for
     * permanently-visible hints.
     */
    open?: boolean;
    /** Delay before the tooltip appears on hover, in milliseconds. */
    delayDuration?: number;
  }) => (
    // The TooltipPrimitive.Provider lives once at the app root (see
    // TooltipProvider in Application). `delayDuration` is set per-instance on
    // Root, which overrides the provider's value — preserving the previous
    // per-tooltip delay behaviour without a provider per instance.
    <TooltipPrimitive.Root open={open} delayDuration={delayDuration}>
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
  )
);
