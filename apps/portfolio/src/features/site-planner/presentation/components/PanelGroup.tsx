import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';

const GLYPH_SIZE_PX = 12;

/**
 * A run of panels that belong together — the structure of the building, its
 * interior, its services — behind one heading that opens and closes (R27).
 *
 * The column used to stand every panel open at once: eight cards deep, the one
 * being worked in was usually below the fold, and the properties of the thing
 * just selected were somewhere in the middle of them. Grouping by what a
 * person is doing — building, furnishing, wiring — means the panels on screen
 * are the panels for the job in hand.
 */
export const PanelGroup = memo(
  ({
    title,
    isOpen,
    onToggle,
    children,
  }: {
    readonly title: string;
    readonly isOpen: boolean;
    readonly onToggle: (title: string) => void;
    readonly children: ReactNode;
  }) => {
    const handleToggle = useFunction(() => onToggle(title));

    return (
      <section className="flex shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left',
            'font-mono text-[10px] uppercase tracking-[0.12em]',
            'transition-colors duration-150',
            isOpen ? 'text-text' : 'text-text-secondary hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          <ChevronDown
            size={GLYPH_SIZE_PX}
            aria-hidden
            className={cn('shrink-0 transition-transform duration-150', !isOpen && '-rotate-90')}
          />
          {title}
        </button>
        {isOpen ? <div className="flex flex-col gap-2.5">{children}</div> : undefined}
      </section>
    );
  }
);
