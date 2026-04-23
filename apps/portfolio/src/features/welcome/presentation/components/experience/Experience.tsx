import { memo } from 'react';

import { welcomeT } from '../../translations';
import { SectionHead } from '../common/SectionHead';
import { ExperienceItem } from './ExperienceItem';

const ExperienceComponent = () => (
  <section
    id="work"
    className="relative mx-auto max-w-[var(--container-narrow)] scroll-mt-16 px-6 py-16 md:px-12 md:pb-20 md:pt-[120px] print:px-0 print:py-4 print:md:px-0 print:md:py-4"
  >
    <SectionHead
      number={welcomeT.experience.sectionNumber}
      kicker={welcomeT.experience.sectionKicker}
      title={welcomeT.experience.sectionTitle}
    />

    <div className="flex flex-col">
      {welcomeT.experience.entries.map(entry => (
        <ExperienceItem key={entry.id} entry={entry} />
      ))}
    </div>
  </section>
);

export const Experience = memo(ExperienceComponent);
