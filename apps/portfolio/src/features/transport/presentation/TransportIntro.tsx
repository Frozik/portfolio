import { memo } from 'react';

import { SectionNumber } from '../../../shared/ui/SectionNumber';
import { transportT } from './translations';

const TransportIntroComponent = () => (
  <section className="flex flex-col gap-6">
    <SectionNumber number="01" label={transportT.kicker} />
    <div className="flex flex-col gap-4">
      <h1 className="text-[clamp(36px,7vw,56px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
        {transportT.headlinePrimary}
        <br />
        <span className="font-serif text-landing-fg-faint italic">{transportT.headlineAccent}</span>
      </h1>
      <p className="max-w-[640px] text-[15px] leading-[1.5] text-landing-fg-dim">
        {transportT.subtitle}
      </p>
    </div>
  </section>
);

export const TransportIntro = memo(TransportIntroComponent);
