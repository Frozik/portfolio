import { memo } from 'react';

import type { IHeroStatTranslation } from '../../translations';

type HeroStatsProps = {
  readonly items: readonly IHeroStatTranslation[];
};

const HeroStatsComponent = ({ items }: HeroStatsProps) => (
  <div className="flex flex-wrap gap-6 border-t border-landing-border-soft pt-6 md:gap-12 md:pt-8">
    {items.map(item => (
      <div key={item.label} className="flex flex-col gap-1">
        <div className="font-mono text-[22px] font-medium tracking-tight text-landing-fg md:text-[28px]">
          {item.value}
          {item.unit && <span className="text-landing-accent">{item.unit}</span>}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-landing-fg-faint md:text-[11px]">
          {item.label}
        </div>
      </div>
    ))}
  </div>
);

export const HeroStats = memo(HeroStatsComponent);
