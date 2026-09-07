import { memo } from 'react';

import { useLiveClock } from '../../hooks/useLiveClock';
import { welcomeT } from '../../translations';
import { StatusDot } from '../common/StatusDot';

/** Same width as a time, so the clock filling in after hydration moves nothing. */
const CLOCK_PLACEHOLDER = '--:--';

const HeroMetaBarComponent = () => {
  const clock = useLiveClock();

  return (
    <div className="mb-6 flex flex-col items-start gap-2 font-mono text-[11px] tracking-wide text-landing-fg-faint md:mb-8 md:flex-row md:flex-wrap md:items-center md:gap-7 md:text-xs">
      <span>
        <span className="text-landing-accent">◆</span> {welcomeT.hero.remote}
      </span>
      <span>
        {welcomeT.hero.utc} · <span className="tabular-nums">{clock ?? CLOCK_PLACEHOLDER}</span>
      </span>
      <span className="inline-flex items-center gap-2 text-landing-green">
        <StatusDot /> {welcomeT.hero.available}
      </span>
    </div>
  );
};

export const HeroMetaBar = memo(HeroMetaBarComponent);
