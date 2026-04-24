import { useFunction } from '@frozik/components/hooks/useFunction';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { cn } from '../lib/cn';

const CLOSE_ICON_SIZE = 16;

type ModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly closeLabel?: string;
};

const ModalComponent = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
  closeLabel = 'Close',
}: ModalProps) => {
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
            'fixed inset-0 z-[100] bg-black/70 backdrop-blur-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[110] w-[min(90vw,380px)] -translate-x-1/2 -translate-y-1/2',
            'border border-landing-border bg-landing-bg-card p-8 text-landing-fg shadow-2xl',
            'rounded-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            className
          )}
        >
          {(title || description) && (
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                {title && (
                  <DialogPrimitive.Title className="font-mono text-[10.5px] uppercase tracking-widest text-landing-accent">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="font-mono text-[10px] uppercase tracking-widest text-landing-fg-faint">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label={closeLabel}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    'border border-landing-border font-mono text-xs text-landing-fg-dim',
                    'transition-colors hover:border-landing-accent hover:text-landing-accent'
                  )}
                >
                  <X size={CLOSE_ICON_SIZE} />
                </button>
              </DialogPrimitive.Close>
            </div>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const Modal = memo(ModalComponent);

export type { ModalProps };
