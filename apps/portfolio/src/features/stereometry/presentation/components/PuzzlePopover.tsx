import { cn } from '@frozik/components/components/cn';
import * as Popover from '@radix-ui/react-popover';
import { Puzzle, X } from 'lucide-react';
import { memo, useState } from 'react';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { PuzzleDefinition } from '../../domain/types';
import { CLOSE_ICON_SIZE, TOOLBAR_ICON_SIZE, TOOLBAR_TOOLTIP_DELAY_MS } from '../constants';
import { stereometryT } from '../translations';
import { SolutionPreview } from './SolutionPreview';

export const PuzzlePopover = memo(({ puzzle }: { readonly puzzle: PuzzleDefinition }) => {
  const [isOpen, setIsOpen] = useState(false);

  const puzzleTranslations: Record<string, { name: string; description: string }> =
    stereometryT.puzzles;
  const translation = puzzleTranslations[puzzle.id];

  if (translation === undefined) {
    return null;
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip title={stereometryT.toolbar.puzzle} delayDuration={TOOLBAR_TOOLTIP_DELAY_MS}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={stereometryT.toolbar.puzzle}
            className={cn(
              'flex size-10 items-center justify-center rounded-lg shadow-lg',
              'transition-all hover:scale-110 active:scale-95',
              isOpen
                ? 'bg-blue-500 text-white scale-110'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            )}
          >
            <Puzzle size={TOOLBAR_ICON_SIZE} />
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
            <span className="font-semibold text-white">{translation.name}</span>
            <Popover.Close
              aria-label={stereometryT.toolbar.close}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X size={CLOSE_ICON_SIZE} />
            </Popover.Close>
          </div>
          <SolutionPreview
            puzzle={puzzle}
            label={stereometryT.solutionImageAlt}
            className="mb-3 w-full rounded-md border border-neutral-700"
          />
          <p className="text-neutral-300">{translation.description}</p>
          <Popover.Arrow className="fill-neutral-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
