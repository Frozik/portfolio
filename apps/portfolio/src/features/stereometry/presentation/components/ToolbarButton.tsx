import type { ReactNode } from 'react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { TOOLBAR_TOOLTIP_DELAY_MS } from '../constants';

export const ToolbarButton = memo(
  ({
    active = false,
    disabled = false,
    onClick,
    children,
    label,
    tooltipDelayMs = TOOLBAR_TOOLTIP_DELAY_MS,
  }: {
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
    label: string;
    tooltipDelayMs?: number;
  }) => (
    <Tooltip title={label} delayDuration={tooltipDelayMs}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'flex size-10 items-center justify-center rounded-lg shadow-lg',
          'transition-all',
          disabled
            ? 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
            : 'hover:scale-110 active:scale-95',
          !disabled && active && 'bg-blue-500 text-white',
          !disabled && !active && 'bg-neutral-800 text-neutral-400 hover:text-white'
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
);
