import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';
import { cn } from '../lib/cn';

type FloatingButtonProps = {
  icon?: ReactNode;
  onClick?: () => void;
  type?: 'default' | 'primary';
  className?: string;
};

const BUTTON_SIZE = 48;

export const FloatingButton = memo(
  ({
    icon,
    onClick,
    type = 'default',
    className,
    inline = false,
  }: FloatingButtonProps & { inline?: boolean }) => (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-full shadow-lg transition-all',
        'hover:scale-110 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        type === 'primary'
          ? 'bg-brand-500 text-white hover:bg-brand-600'
          : 'bg-surface-elevated text-text hover:bg-surface-overlay',
        !inline && 'fixed bottom-6 left-6 z-[100]',
        className
      )}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
    >
      {icon}
    </button>
  )
);

type FloatingButtonGroupProps = {
  icon?: ReactNode;
  trigger?: 'hover' | 'click';
  type?: 'default' | 'primary';
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
};

export const FloatingButtonGroup = memo(
  ({
    icon,
    trigger = 'hover',
    type = 'default',
    onClick,
    children,
    className,
  }: FloatingButtonGroupProps) => {
    const [open, setOpen] = useState(false);

    const handleMouseEnter = trigger === 'hover' ? () => setOpen(true) : undefined;
    const handleMouseLeave = trigger === 'hover' ? () => setOpen(false) : undefined;
    const handleClick = () => {
      if (trigger === 'click') {
        setOpen(prev => !prev);
      }
      if (!isNil(onClick)) {
        onClick();
      }
    };

    return (
      <div
        className={cn('fixed bottom-6 right-6 flex flex-col-reverse items-center gap-3', className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <FloatingButton icon={icon} onClick={handleClick} type={type} inline />
        {open && (
          <div className="flex flex-col-reverse items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-2">
            {children}
          </div>
        )}
      </div>
    );
  }
);

export type { FloatingButtonGroupProps, FloatingButtonProps };
