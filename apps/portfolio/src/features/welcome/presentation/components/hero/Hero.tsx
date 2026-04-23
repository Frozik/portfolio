import type { Temporal } from '@js-temporal/polyfill';
import { memo, useMemo } from 'react';

import { getYearsOfExperience } from '../../../utils';
import type { IExperienceTranslation, IHeroStatTranslation } from '../../translations';
import { welcomeT } from '../../translations';
import { HeroMetaBar } from './HeroMetaBar';
import { HeroOrderbook } from './HeroOrderbook';
import { HeroStats } from './HeroStats';

function findEarliestStart(entries: readonly IExperienceTranslation[]): Temporal.PlainDate {
  return entries.reduce<Temporal.PlainDate>(
    (earliest, entry) => (entry.start.since(earliest).sign < 0 ? entry.start : earliest),
    entries[0].start
  );
}

const HeroComponent = () => {
  const { yearsOfExperience, stats } = useMemo(() => {
    const earliestStart = findEarliestStart(welcomeT.experience.entries);
    const years = getYearsOfExperience(earliestStart);
    const composedStats: readonly IHeroStatTranslation[] = [
      { value: String(years), unit: '+', label: welcomeT.hero.yearsOfExperienceLabel },
      ...welcomeT.hero.stats,
    ];
    return { yearsOfExperience: years, stats: composedStats };
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-[calc(100dvh-60px)] flex-col justify-center overflow-hidden px-6 pt-10 pb-24 md:px-12 md:pt-16 md:pb-24 print:hidden"
    >
      <HeroOrderbook />

      <div className="relative z-10 mx-auto w-full max-w-[var(--container-narrow)]">
        <HeroMetaBar />

        <h1 className="mb-6 text-[clamp(32px,11vw,48px)] font-medium leading-[1.02] tracking-[-0.04em] md:mb-8 md:text-[clamp(48px,7vw,96px)]">
          {welcomeT.hero.headline1}
          <br />
          {welcomeT.hero.headline2}{' '}
          <span className="font-serif text-[0.9em] italic text-landing-fg-dim">&amp;</span>{' '}
          <span className="text-landing-accent">{welcomeT.hero.headlineAccent}</span>.
        </h1>

        <p className="mb-9 max-w-[640px] text-[15px] font-light leading-[1.5] text-landing-fg-dim md:mb-12 md:text-xl">
          <a
            href="#contact"
            className="group font-medium text-landing-fg underline decoration-landing-accent/40 decoration-1 underline-offset-[5px] transition-[color,text-decoration-color] hover:text-landing-accent hover:decoration-landing-accent"
          >
            {welcomeT.hero.name}
            <span className="ml-1 inline-block text-landing-accent transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>{' '}
          {welcomeT.hero.lead(yearsOfExperience)}
        </p>

        <HeroStats items={stats} />

        <div className="mt-7 flex flex-col gap-2.5 md:mt-9 md:flex-row md:gap-3.5">
          <a
            href="#projects"
            className="group relative inline-flex items-center gap-3.5 overflow-hidden border border-landing-accent bg-landing-accent px-5 py-4 font-mono text-[11px] uppercase tracking-wider text-black transition-all hover:translate-x-0.5 md:px-[22px] md:text-xs"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="relative z-10 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-current text-xs transition-transform group-hover:translate-x-0.5">
              →
            </span>
            <span className="relative z-10">{welcomeT.hero.seeWork}</span>
            <span className="relative z-10 ml-auto border-l border-black/35 pl-3.5 text-[10px] opacity-65">
              {welcomeT.hero.projectCount}
            </span>
          </a>
        </div>
      </div>

      <div className="scroll-line absolute bottom-6 left-6 z-20 hidden items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-landing-fg-faint md:bottom-10 md:left-12 md:flex">
        {welcomeT.hero.scrollHint}
      </div>
    </section>
  );
};

export const Hero = memo(HeroComponent);
