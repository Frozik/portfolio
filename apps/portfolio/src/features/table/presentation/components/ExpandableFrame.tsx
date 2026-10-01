import './ExpandableFrame.css';

import { isNil } from 'lodash-es';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '@frozik/components/components/cn';

import { tableDemoT } from '../translations';

const ICON_SIZE_PX = 16;
/** Matches the name the stylesheet animates. */
const TRANSITION_NAME = 'table-frame';

/**
 * Holds a table in its place on the page and, by its button, stretches it
 * over the whole screen from where it stands — and back. The table is the
 * same element in both states, so its scroll, selection and open editors
 * survive; the slot it left keeps its size, so nothing behind it moves.
 */
export const ExpandableFrame = memo(
  ({ className, children }: { readonly className?: string; readonly children: ReactNode }) => {
    const [expanded, setExpanded] = useState(false);
    const frameRef = useRef<HTMLDivElement>(null);

    const toggle = useEventCallback(() => {
      const frame = frameRef.current;
      const prefersStillness = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isNil(frame) || isNil(document.startViewTransition) || prefersStillness) {
        setExpanded(current => !current);
        return;
      }
      // A transition name must be the only one on the page, so only the frame in motion carries it.
      frame.style.viewTransitionName = TRANSITION_NAME;
      const transition = document.startViewTransition(() => {
        flushSync(() => setExpanded(current => !current));
      });
      void transition.finished.finally(() => {
        frame.style.viewTransitionName = '';
      });
    });

    const label = expanded ? tableDemoT.controls.collapse : tableDemoT.controls.expand;
    return (
      <div className={cn('flex min-h-0 min-w-0', className)}>
        <div
          ref={frameRef}
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            expanded ? 'fixed inset-0 z-[60] bg-landing-bg p-1 sm:p-3' : 'relative flex-1'
          )}
        >
          {children}
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            aria-pressed={expanded}
            title={label}
            className="absolute right-5 bottom-5 z-10 flex size-9 items-center justify-center rounded-full bg-neutral-900/70 text-neutral-100 opacity-80 shadow-lg backdrop-blur transition-opacity hover:opacity-100"
          >
            {expanded ? (
              <Minimize2 size={ICON_SIZE_PX} aria-hidden="true" />
            ) : (
              <Maximize2 size={ICON_SIZE_PX} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    );
  }
);
