import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../lib/cn';

type DropdownProps = {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export const Dropdown = memo(
  ({ trigger, children, open, onOpenChange, className }: DropdownProps) => (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className={cn(
            'z-50 min-w-32 rounded-lg border border-border bg-surface-elevated p-1 shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            className
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
);

type DropdownItemProps = {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
};

export const DropdownItem = memo(
  ({ children, onSelect, disabled, className }: DropdownItemProps) => (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-text',
        'outline-none hover:bg-surface-overlay focus:bg-surface-overlay',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
    >
      {children}
    </DropdownMenu.Item>
  )
);

export type { DropdownItemProps, DropdownProps };
