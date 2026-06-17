import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { isNil } from 'lodash-es';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';

const CLOSE_ICON_SIZE_PX = 18;
const FALLBACK_TITLE = 'Menu';

export const Drawer = memo(
  ({
    title,
    open,
    onClose,
    placement = 'right',
    children,
    className,
  }: {
    title?: ReactNode;
    open: boolean;
    onClose: () => void;
    placement?: 'left' | 'right';
    children?: ReactNode;
    className?: string;
  }) => {
    const handleOpenChange = useFunction((nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    });

    return (
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay
            forceMount
            className={cn(
              'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
              open ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          />
          <DialogPrimitive.Content
            forceMount
            aria-describedby={undefined}
            className={cn(
              'fixed z-50 flex flex-col bg-surface-elevated shadow-xl',
              // Mobile: bottom sheet, 50% height. Desktop: side drawer.
              'inset-x-0 bottom-0 h-1/2 rounded-t-2xl',
              'md:inset-x-auto md:top-0 md:h-full md:w-80 md:rounded-t-none',
              {
                'transition-transform duration-200': open,
                invisible: !open,
                // Mobile vertical slide (reset to 0 on desktop, which slides horizontally)
                'translate-y-0': open,
                'translate-y-full': !open,
                'md:translate-y-0': !open,
                // Desktop side + horizontal slide
                'md:left-0': placement === 'left',
                'md:right-0': placement === 'right',
                'md:translate-x-0': open,
                'md:-translate-x-full': placement === 'left' && !open,
                'md:translate-x-full': placement === 'right' && !open,
              },
              className
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <DialogPrimitive.Title
                className={cn('text-lg font-semibold text-text', isNil(title) && 'sr-only')}
              >
                {title ?? FALLBACK_TITLE}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-1 text-text-secondary hover:bg-surface-overlay hover:text-text"
                >
                  <X size={CLOSE_ICON_SIZE_PX} />
                </button>
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }
);
