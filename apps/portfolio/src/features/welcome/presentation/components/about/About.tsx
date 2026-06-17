import { memo } from 'react';

import avatarAvifUrl from '../../../../../assets/avatar.avif';
import avatarPngUrl from '../../../../../assets/avatar.png';
import avatarWebpUrl from '../../../../../assets/avatar.webp';
import { useAvailability } from '../../hooks/useAvailability';
import { welcomeT } from '../../translations';
import { IdeaLightbulb } from '../common/IdeaLightbulb';
import { SectionHead } from '../common/SectionHead';
import { SleepingZzz } from '../common/SleepingZzz';
import { ContactList } from '../contacts/ContactList';
import { DownloadCvButton } from './DownloadCvButton';

const AboutComponent = () => {
  const { isAwake } = useAvailability();

  return (
    <section
      id="about"
      className="relative mx-auto max-w-[var(--container-narrow)] scroll-mt-16 px-6 py-16 md:px-12 md:pb-20 md:pt-[140px] print:px-0 print:py-4 print:md:px-0 print:md:py-4"
    >
      <SectionHead
        number={welcomeT.about.sectionNumber}
        kicker={welcomeT.about.sectionKicker}
        title={welcomeT.about.sectionTitle}
      />

      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[1fr_320px] md:gap-16">
        <div className="text-[15.5px] font-light leading-[1.65] text-landing-fg-dim md:text-[17px] md:leading-[1.7]">
          <p>{welcomeT.about.paragraph1}</p>
          <p className="mt-[18px]">{welcomeT.about.paragraph2}</p>
          <p className="mt-[18px]">{welcomeT.about.paragraph3}</p>
        </div>

        <div>
          <div className="relative mx-auto mb-6 aspect-square w-full max-w-[260px] overflow-visible md:mx-0">
            <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-landing-border bg-landing-bg-card shadow-[0_0_0_1px_rgb(96_165_250_/_0.08)]">
              <picture>
                <source srcSet={avatarAvifUrl} type="image/avif" />
                <source srcSet={avatarWebpUrl} type="image/webp" />
                <img
                  src={avatarPngUrl}
                  alt={welcomeT.hero.name}
                  className="block h-full w-full object-cover"
                />
              </picture>
            </div>
            {isAwake ? <IdeaLightbulb /> : <SleepingZzz />}
          </div>
          <ContactList className="flex flex-col font-mono text-[13px]">
            <DownloadCvButton />
          </ContactList>
        </div>
      </div>
    </section>
  );
};

export const About = memo(AboutComponent);
