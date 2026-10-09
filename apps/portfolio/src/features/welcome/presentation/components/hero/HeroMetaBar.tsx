import { lazy, memo, Suspense, useId, useRef } from 'react';

import { useHoverDisclosure } from '../../hooks/useHoverDisclosure';
import { useLiveClock } from '../../hooks/useLiveClock';
import { welcomeT } from '../../translations';
import { StatusDot } from '../common/StatusDot';

/** Same width as a time, so the clock filling in after hydration moves nothing. */
const CLOCK_PLACEHOLDER = '--:--';

const loadSkyDialPanel = () => import('./sky-dial/SkyDialPanel');
const SkyDialPanel = lazy(() =>
  loadSkyDialPanel().then(module => ({ default: module.SkyDialPanel }))
);

function prefetchSkyDialPanel(): void {
  void loadSkyDialPanel();
}

const HeroMetaBarComponent = () => {
  const clock = useLiveClock();
  const clockRootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const { isOpen, onPointerEnter, onPointerLeave, onClick } = useHoverDisclosure(clockRootRef);

  return (
    <div className="mb-6 flex flex-col items-start gap-2 font-mono text-[11px] tracking-wide text-landing-fg-faint md:mb-8 md:flex-row md:flex-wrap md:items-center md:gap-7 md:text-xs">
      <span>
        <span className="text-landing-accent">◆</span> {welcomeT.hero.remote}
      </span>
      <span
        ref={clockRootRef}
        className="relative"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <button
          type="button"
          aria-label={welcomeT.hero.sky.open}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onClick}
          onPointerEnter={prefetchSkyDialPanel}
          onFocus={prefetchSkyDialPanel}
          className="cursor-pointer bg-transparent p-0 font-mono tracking-wide text-inherit underline decoration-dotted decoration-landing-fg-faint/50 underline-offset-4 transition-colors hover:text-landing-fg-dim focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent"
        >
          {welcomeT.hero.myTime} <span className="tabular-nums">{clock ?? CLOCK_PLACEHOLDER}</span>{' '}
          · {welcomeT.hero.utc}
        </button>
        {isOpen && (
          <span
            id={panelId}
            className="absolute top-full left-0 z-50 block pt-2 animate-in fade-in-0 zoom-in-95"
          >
            <Suspense fallback={null}>
              <SkyDialPanel />
            </Suspense>
          </span>
        )}
      </span>
      <span className="inline-flex items-center gap-2 text-landing-green">
        <StatusDot /> {welcomeT.hero.available}
      </span>
    </div>
  );
};

export const HeroMetaBar = memo(HeroMetaBarComponent);
