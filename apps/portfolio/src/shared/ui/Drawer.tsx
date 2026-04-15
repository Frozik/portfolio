import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useEffect } from 'react';
import { cn } from '../lib/cn';

type DrawerProps = {
  title?: ReactNode;
  open: boolean;
  onClose: () => void;
  placement?: 'left' | 'right';
  children?: ReactNode;
  className?: string;
};

export const Drawer = memo(
  ({ title, open, onClose, placement = 'right', children, className }: DrawerProps) => {
    useEffect(() => {
      if (!open) {
        return;
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    return (
      <>
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
        )}
        <div
          className={cn(
            // Shared base
            'fixed z-50 flex flex-col bg-surface-elevated shadow-xl',
            open && 'transition-transform duration-200',
            !open && 'invisible',
            // Mobile: bottom sheet, 50% height
            'inset-x-0 bottom-0 h-1/2 rounded-t-2xl',
            open ? 'translate-y-0' : 'translate-y-full',
            // Desktop: side drawer
            'md:inset-x-auto md:top-0 md:h-full md:w-80 md:rounded-t-none',
            placement === 'left' ? 'md:left-0' : 'md:right-0',
            placement === 'left'
              ? open
                ? 'md:translate-x-0'
                : 'md:-translate-x-full'
              : open
                ? 'md:translate-x-0'
                : 'md:translate-x-full',
            // Reset mobile translate-y on desktop
            open ? '' : 'md:translate-y-0',
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            {title && <h2 className="text-lg font-semibold text-text">{title}</h2>}
            <button
              className="rounded-md p-1 text-text-secondary hover:bg-surface-overlay hover:text-text"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      </>
    );
  }
);

export type { DrawerProps };
