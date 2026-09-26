import * as Popover from '@radix-ui/react-popover';
import { CircleQuestionMark, X } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '@frozik/components/components/cn';

import { Tooltip } from '../../../../shared/ui/Tooltip';
import { osmMapT } from '../translations';

const ICON_SIZE_PX = 20;
const CLOSE_ICON_SIZE_PX = 16;

/** The gestures and what stands on the map, behind a question mark in the corner. */
export const HelpPopover = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const { help } = osmMapT;
  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip title={help.open}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={help.open}
            className={cn(
              'absolute right-3 bottom-10 flex size-11 items-center justify-center rounded-full shadow-lg backdrop-blur transition-transform hover:scale-110 active:scale-95',
              isOpen ? 'bg-blue-500 text-white' : 'bg-neutral-900/70 text-neutral-200'
            )}
          >
            <CircleQuestionMark size={ICON_SIZE_PX} aria-hidden="true" />
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
            'z-50 w-80 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-white">{help.title}</span>
            <Popover.Close
              aria-label={help.close}
              className="text-neutral-500 transition-colors hover:text-white"
            >
              <X size={CLOSE_ICON_SIZE_PX} />
            </Popover.Close>
          </div>
          {help.sections.map(section => (
            <section key={section.title} className="mb-3 last:mb-0">
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
                {section.title}
              </h3>
              <ul className="space-y-1 text-neutral-300">
                {section.items.map(([label, description]) => (
                  <li key={label}>
                    <strong className="text-neutral-100">{label}</strong> — {description}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Popover.Arrow className="fill-neutral-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
