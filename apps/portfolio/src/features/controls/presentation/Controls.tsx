import { memo } from 'react';

import { SectionNumber } from '../../../shared/ui';
import { ControlsBackground } from './components/ControlsBackground';
import { DatePage } from './components/DatePage';
import { NumberPage } from './components/NumberPage';
import { controlsT } from './translations';

export const Controls = memo(() => (
  <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className="pointer-events-none absolute inset-0 z-0">
      <ControlsBackground />
    </div>
    <div className="relative z-10 mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-12 px-6 pt-12 pb-20 sm:px-8">
      <section className="flex flex-col gap-6">
        <SectionNumber number="01" label={controlsT.lobby.sectionKicker} />
        <div className="flex flex-col gap-4">
          <h1 className="text-[clamp(40px,8vw,64px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
            {controlsT.lobby.headlinePrimary}
            <br />
            <span className="font-serif text-landing-fg-faint italic">
              {controlsT.lobby.headlineAccent}
            </span>
          </h1>
          <p className="max-w-[560px] text-[15px] leading-[1.5] text-landing-fg-dim">
            {controlsT.lobby.heroSubtitle}
          </p>
        </div>
      </section>
      <NumberPage />
      <DatePage />
    </div>
  </div>
));
