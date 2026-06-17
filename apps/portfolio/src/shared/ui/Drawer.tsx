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
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
              'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out'
            )}
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className={cn(
              'fixed z-50 flex flex-col bg-surface-elevated shadow-xl',
              // Mobile: bottom sheet, 50% height (slides up from the bottom)
              'inset-x-0 bottom-0 h-1/2 rounded-t-2xl',
              'data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom',
              // Desktop: side drawer. `animate-*` is a single property, so the `md:`
              // variant fully replaces the mobile vertical slide — no diagonal motion.
              'md:inset-x-auto md:top-0 md:h-full md:w-80 md:rounded-t-none',
              {
                'md:left-0': placement === 'left',
                'md:right-0': placement === 'right',
                'md:data-[state=open]:animate-slide-in-left md:data-[state=closed]:animate-slide-out-left':
                  placement === 'left',
                'md:data-[state=open]:animate-slide-in-right md:data-[state=closed]:animate-slide-out-right':
                  placement === 'right',
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
