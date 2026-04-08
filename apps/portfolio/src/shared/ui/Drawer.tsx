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
            'fixed top-0 z-50 flex h-full w-80 flex-col bg-surface-elevated shadow-xl transition-transform duration-200',
            placement === 'left' ? 'left-0' : 'right-0',
            placement === 'left'
              ? open
                ? 'translate-x-0'
                : '-translate-x-full'
              : open
                ? 'translate-x-0'
                : 'translate-x-full',
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
