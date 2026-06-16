import { cn } from '@frozik/components/components/cn';
import * as Popover from '@radix-ui/react-popover';
import { Info, X } from 'lucide-react';
import { memo, useState } from 'react';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { CLOSE_ICON_SIZE, TOOLBAR_ICON_SIZE, TOOLBAR_TOOLTIP_DELAY_MS } from '../constants';
import { stereometryT } from '../translations';

export const HelpPopover = memo(() => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip title={stereometryT.toolbar.help} delayDuration={TOOLBAR_TOOLTIP_DELAY_MS}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={stereometryT.toolbar.help}
            className={cn(
              'flex size-10 items-center justify-center rounded-lg shadow-lg',
              'transition-all hover:scale-110 active:scale-95',
              isOpen
                ? 'bg-blue-500 text-white scale-110'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            )}
          >
            <Info size={TOOLBAR_ICON_SIZE} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          align="end"
          collisionPadding={16}
          className={cn(
            'z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl',
            'border border-neutral-700',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-white">{stereometryT.help.title}</span>
            <Popover.Close
              aria-label={stereometryT.toolbar.close}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X size={CLOSE_ICON_SIZE} />
            </Popover.Close>
          </div>
          <p className="mb-3 text-neutral-400">{stereometryT.help.description}</p>
          <ul className="space-y-1.5 text-neutral-300">
            <li>
              <strong className="text-neutral-100">{stereometryT.help.controlLabels.drag}</strong> —{' '}
              {stereometryT.help.controls.drag}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.shiftDrag}
              </strong>{' '}
              — {stereometryT.help.controls.shiftDrag}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.scrollPinch}
              </strong>{' '}
              — {stereometryT.help.controls.scrollPinch}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.clickEdge}
              </strong>{' '}
              — {stereometryT.help.controls.clickEdge}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.doubleClickEdge}
              </strong>{' '}
              — {stereometryT.help.controls.doubleClickEdge}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.doubleClickLine}
              </strong>{' '}
              — {stereometryT.help.controls.doubleClickLine}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.dragVertex}
              </strong>{' '}
              — {stereometryT.help.controls.dragVertex}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.selectEdgeTapVertex}
              </strong>{' '}
              — {stereometryT.help.controls.selectEdgeTapVertex}
            </li>
            <li>
              <strong className="text-neutral-100">
                {stereometryT.help.controlLabels.holdDragLineVertex}
              </strong>{' '}
              — {stereometryT.help.controls.holdDragLineVertex}
            </li>
          </ul>
          <p className="mt-3 text-xs text-neutral-500">{stereometryT.help.intersectionHint}</p>
          <Popover.Arrow className="fill-neutral-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
