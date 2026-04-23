import { memo } from 'react';

import { welcomeT } from '../../translations';
import { SectionHead } from '../common/SectionHead';
import { SkillGroup } from './SkillGroup';

const SkillsComponent = () => (
  <section
    id="skills"
    className="relative mx-auto max-w-[var(--container-narrow)] scroll-mt-16 px-6 py-16 md:px-12 md:pb-20 md:pt-[120px] print:px-0 print:py-4 print:md:px-0 print:md:py-4 print:break-inside-avoid"
  >
    <SectionHead
      number={welcomeT.skills.sectionNumber}
      kicker={welcomeT.skills.sectionKicker}
      title={welcomeT.skills.sectionTitle}
      className="print:hidden"
    />

    <div className="grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-10 print:flex print:flex-col print:gap-y-1">
      {welcomeT.skills.groups.map(entry => (
        <SkillGroup key={entry.group} group={entry.group} items={entry.items} />
      ))}
    </div>
  </section>
);

export const Skills = memo(SkillsComponent);
