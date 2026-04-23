import { useFunction } from '@frozik/components';
import { memo, useState } from 'react';

import avatarUrl from '../../../../../assets/avatar.png';
import { CONTACT_LINKS } from '../../contentData';
import { useIsAwake } from '../../hooks/useIsAwake';
import { welcomeT } from '../../translations';
import { IdeaLightbulb } from '../common/IdeaLightbulb';
import { SectionHead } from '../common/SectionHead';
import { SleepingZzz } from '../common/SleepingZzz';
import type { IContactQRRequest } from '../contacts/ContactRow';
import { ContactRow } from '../contacts/ContactRow';
import { QRContactModal } from '../contacts/QRContactModal';

const AboutComponent = () => {
  const [qrRequest, setQrRequest] = useState<IContactQRRequest | null>(null);
  const isAwake = useIsAwake();

  const handleQRRequest = useFunction((payload: IContactQRRequest) => setQrRequest(payload));
  const handleQRClose = useFunction(() => setQrRequest(null));

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
              <img
                src={avatarUrl}
                alt={welcomeT.hero.name}
                className="block h-full w-full object-cover"
              />
            </div>
            {isAwake ? <IdeaLightbulb /> : <SleepingZzz />}
          </div>
          <div className="flex flex-col font-mono text-[13px]">
            {CONTACT_LINKS.map(link => {
              const labels = welcomeT.contacts.entries[link.iconKey];
              return (
                <ContactRow
                  key={link.iconKey}
                  iconKey={link.iconKey}
                  label={labels.label}
                  href={link.href}
                  qrValue={link.qrValue}
                  qrTitle={link.qrValue ? labels.qrTitle : undefined}
                  preferred={link.preferred}
                  onQRRequest={handleQRRequest}
                />
              );
            })}
          </div>
        </div>
      </div>

      <QRContactModal
        open={qrRequest !== null}
        value={qrRequest?.value ?? ''}
        title={qrRequest?.title ?? ''}
        onClose={handleQRClose}
      />
    </section>
  );
};

export const About = memo(AboutComponent);
