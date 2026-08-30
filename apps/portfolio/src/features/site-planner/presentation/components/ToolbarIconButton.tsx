import { cn } from '@frozik/components/components/cn';
import type { LucideIcon } from 'lucide-react';
import { memo } from 'react';

import { Tooltip } from '../../../../shared/ui/Tooltip';

const ICON_SIZE_PX = 16;

/** The look every square button of the feature toolbar shares. */
export function toolbarIconButtonClass({
  isActive = false,
  isEnabled = true,
}: {
  readonly isActive?: boolean;
  readonly isEnabled?: boolean;
} = {}): string {
  return cn(
    'flex size-8 items-center justify-center rounded-lg transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
    !isEnabled && 'cursor-not-allowed text-text-muted',
    isEnabled && isActive && 'bg-brand-500 text-white',
    isEnabled && !isActive && 'text-text-secondary hover:bg-white/10 hover:text-text'
  );
}

/**
 * An icon action of the feature toolbar: a square button with its name in a
 * tooltip. Whether it is a toggle is told by `isActive` — left out, the button
 * simply acts and never looks pressed.
 */
export const ToolbarIconButton = memo(
  ({
    icon: Icon,
    label,
    isActive,
    isEnabled = true,
    onActivate,
  }: {
    readonly icon: LucideIcon;
    readonly label: string;
    readonly isActive?: boolean;
    readonly isEnabled?: boolean;
    readonly onActivate: VoidFunction;
  }) => (
    <Tooltip title={label} placement="bottom">
      {/* A disabled button fires no pointer events, so the tooltip listens on a wrapper. */}
      <span className="inline-flex">
        <button
          type="button"
          aria-label={label}
          aria-pressed={isActive}
          disabled={!isEnabled}
          onClick={onActivate}
          className={toolbarIconButtonClass({ isActive, isEnabled })}
        >
          <Icon size={ICON_SIZE_PX} aria-hidden />
        </button>
      </span>
    </Tooltip>
  )
);
