import type { ReactNode } from 'react';
import { memo } from 'react';

/**
 * The dark card every side panel of the planner sits in. It never shrinks: the
 * column it stands in is the one thing that scrolls, and a card squeezed by its
 * neighbours would spill its own content over the card below.
 */
export const PlannerPanel = memo(
  ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
    <section
      aria-label={title}
      className="flex shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
        {title}
      </h2>
      {children}
    </section>
  )
);
