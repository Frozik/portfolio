import { useFunction } from '@frozik/components';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { cn } from '../lib/cn';
import { MonoKicker } from './MonoKicker';

const CLOSE_ICON_SIZE_PX = 14;
const DEFAULT_CLOSE_LABEL = 'Close';

type DialogShellAccent = 'yellow' | 'purple';

type DialogShellProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly kicker?: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly closeLabel?: string;
  /**
   * Disables dismissing the dialog via Esc / outside clicks. Used for
   * sticky dialogs like the first-visit Identity setup.
   */
  readonly dismissible?: boolean;
  /**
   * Optional content rendered at the far right of the header (before the
   * Close button). Useful when a dialog has no close button and needs to
   * expose extra actions.
   */
  readonly headerExtra?: ReactNode;
  /**
   * Accent palette applied to the dialog. Defaults to `'yellow'`, which is
   * the current Retro design. `'purple'` is reserved for the Conf feature
   * and does not yet introduce visual changes — the prop is declared now so
   * call sites can be wired up ahead of the styling rollout.
   */
  readonly accent?: DialogShellAccent;
};

/**
 * Shared Radix Dialog shell for the landing-design surfaces. Applies the
 * landing design language (`--color-landing-*` palette, mono kicker, hairline
 * accent borders) consistently across dialogs so they read as one family of
 * surfaces.
 */
const DialogShellComponent = ({
  open,
  onClose,
  kicker,
  title,
  description,
  footer,
  children,
  className,
  closeLabel = DEFAULT_CLOSE_LABEL,
  dismissible = true,
  headerExtra,
  accent = 'yellow',
}: DialogShellProps) => {
  const handleOpenChange = useFunction((nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  });

  const preventClose = useFunction((event: Event) => {
    event.preventDefault();
  });

  const hardInteractionGuard = dismissible ? undefined : preventClose;

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
          data-accent={accent}
          onPointerDownOutside={hardInteractionGuard}
          onEscapeKeyDown={hardInteractionGuard}
          onInteractOutside={hardInteractionGuard}
          className={cn(
            'fixed left-1/2 top-1/2 z-[110] w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2',
            'rounded-sm border border-landing-border bg-landing-bg-card p-8 text-landing-fg shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            className
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              {kicker !== undefined && (
                <MonoKicker tone="accent" className="tracking-widest text-[10.5px]">
                  {kicker}
                </MonoKicker>
              )}
              <DialogPrimitive.Title className="mt-1 text-[22px] font-medium text-landing-fg">
                {title}
              </DialogPrimitive.Title>
              {description !== undefined && (
                <DialogPrimitive.Description className="mt-1.5 text-[13.5px] font-light text-landing-fg-dim">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerExtra}
              {dismissible && (
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    aria-label={closeLabel}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full',
                      'border border-landing-border text-landing-fg-dim',
                      'transition-colors hover:border-landing-accent hover:text-landing-accent'
                    )}
                  >
                    <X size={CLOSE_ICON_SIZE_PX} />
                  </button>
                </DialogPrimitive.Close>
              )}
            </div>
          </div>
          <div className="mt-1">{children}</div>
          {footer !== undefined && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const DialogShell = memo(DialogShellComponent);

export type { DialogShellProps };
