import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import * as Popover from '@radix-ui/react-popover';
import { isNil } from 'lodash-es';
import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';

import { Tooltip } from '../../../../shared/ui/Tooltip';

/** One of the things a flyout button can be armed with: a shape to draw, an object to place. */
export interface FlyoutVariant<Value> {
  readonly key: string;
  readonly label: string;
  readonly icon: ReactNode;
  /** The letter that reaches this variant directly, where it has one. */
  readonly hotkey?: string;
  readonly value: Value;
}

export interface FlyoutVariantGroup<Value> {
  readonly key: string;
  /** Nothing means an unheaded run of variants — a single group needs no caption. */
  readonly title?: string;
  readonly variants: readonly FlyoutVariant<Value>[];
}

/** Which way the flyout opens: away from the rail, towards the canvas. */
export type FlyoutSide = 'right' | 'bottom';

const FLYOUT_OFFSET_PX = 8;
const FLYOUT_COLLISION_PADDING_PX = 16;

function FlyoutVariantRow<Value>({
  variant,
  isArmed,
  onChoose,
}: {
  readonly variant: FlyoutVariant<Value>;
  readonly isArmed: boolean;
  readonly onChoose: (value: Value) => void;
}) {
  const handleClick = useFunction(() => onChoose(variant.value));

  return (
    <button
      type="button"
      aria-pressed={isArmed}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        isArmed
          ? 'bg-brand-500/20 text-text'
          : 'text-text-secondary hover:bg-white/10 hover:text-text'
      )}
    >
      <span className="flex shrink-0 items-center justify-center">{variant.icon}</span>
      <span className="min-w-0 flex-1 truncate">{variant.label}</span>
      {!isNil(variant.hotkey) && (
        <span className="shrink-0 font-mono text-[10px] text-text-muted">{variant.hotkey}</span>
      )}
    </button>
  );
}

/**
 * A tool button that stands for several variants of one tool, the way a graphics
 * editor's flyout does: the body wears the armed variant and activates the tool
 * with it, while the triangle in its corner — or a right click anywhere on the
 * button — opens the list the armed one is chosen from.
 */
export function FlyoutToolButton<Value>({
  title,
  menuLabel,
  icon,
  isActive,
  side,
  armedKey,
  groups,
  onActivate,
  onChoose,
}: {
  readonly title: string;
  /** Accessible name of the corner triangle, which the icon alone cannot carry. */
  readonly menuLabel: string;
  readonly icon: ReactNode;
  readonly isActive: boolean;
  readonly side: FlyoutSide;
  readonly armedKey: string;
  readonly groups: readonly FlyoutVariantGroup<Value>[];
  readonly onActivate: () => void;
  readonly onChoose: (value: Value) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleContextMenu = useFunction((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsOpen(true);
  });

  const handleChoose = useFunction((value: Value) => {
    setIsOpen(false);
    onChoose(value);
  });

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Anchor asChild>
        <div className="relative shrink-0">
          <Tooltip title={title} placement={side}>
            <button
              type="button"
              aria-label={title}
              aria-pressed={isActive}
              onClick={onActivate}
              onContextMenu={handleContextMenu}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                isActive
                  ? 'bg-brand-500 text-white'
                  : 'text-text-secondary hover:bg-white/10 hover:text-text'
              )}
            >
              {icon}
            </button>
          </Tooltip>

          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={menuLabel}
              className={cn(
                'absolute bottom-0 right-0 flex size-4 items-end justify-end rounded-br-lg p-0.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                isActive ? 'text-white/80 hover:text-white' : 'text-text-muted hover:text-text'
              )}
            >
              <svg viewBox="0 0 6 6" className="size-1.5" fill="currentColor" aria-hidden="true">
                <path d="M6 0v6H0Z" />
              </svg>
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side={side}
          align="start"
          sideOffset={FLYOUT_OFFSET_PX}
          collisionPadding={FLYOUT_COLLISION_PADDING_PX}
          aria-label={menuLabel}
          className={cn(
            'z-50 flex w-44 flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-1.5 shadow-md',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
        >
          {groups.map(group => (
            <div key={group.key} className="flex flex-col gap-0.5">
              {!isNil(group.title) && (
                <span className="px-2 text-[10px] uppercase tracking-wide text-text-muted">
                  {group.title}
                </span>
              )}
              {group.variants.map(variant => (
                <FlyoutVariantRow
                  key={variant.key}
                  variant={variant}
                  isArmed={variant.key === armedKey}
                  onChoose={handleChoose}
                />
              ))}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
