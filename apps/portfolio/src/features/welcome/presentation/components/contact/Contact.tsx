import { useFunction } from '@frozik/components';
import { memo, useState } from 'react';

import { CONTACT_LINKS } from '../../contentData';
import { welcomeT } from '../../translations';
import { AvailabilityBadge } from '../common/AvailabilityBadge';
import type { IContactQRRequest } from '../contacts/ContactRow';
import { ContactRow } from '../contacts/ContactRow';
import { QRContactModal } from '../contacts/QRContactModal';

const COPYRIGHT_YEAR = 2026;

const ContactComponent = () => {
  const [qrRequest, setQrRequest] = useState<IContactQRRequest | null>(null);

  const handleQRRequest = useFunction((payload: IContactQRRequest) => setQrRequest(payload));
  const handleQRClose = useFunction(() => setQrRequest(null));

  return (
    <section
      id="contact"
      className="relative mx-auto max-w-[var(--container-narrow)] scroll-mt-16 px-6 py-16 md:px-12 md:pb-20 md:pt-[120px] print:hidden"
    >
      <div className="border-t border-landing-border-soft pt-12 md:pt-16">
        <div className="mb-5 font-mono text-[11px] uppercase tracking-wider text-landing-accent md:text-xs">
          {welcomeT.contact.sectionNumber} / {welcomeT.contact.sectionKicker}
        </div>
        <h2 className="mb-10 max-w-[800px] text-[clamp(30px,8vw,44px)] font-medium leading-[1.1] tracking-[-0.02em] md:mb-12 md:text-[clamp(40px,5vw,60px)]">
          {welcomeT.contact.headline1}
          <br />
          <span className="text-landing-accent">{welcomeT.contact.headline2}</span>
        </h2>

        <p className="mb-10 max-w-[560px] text-[15px] font-light leading-[1.6] text-landing-fg-dim md:mb-12 md:text-[17px]">
          {welcomeT.contact.lead}
        </p>

        <div className="mb-14 grid max-w-[720px] grid-cols-1 gap-x-10 gap-y-1 font-mono text-[13px] md:mb-16 md:grid-cols-2">
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

        <div className="flex flex-col justify-between gap-4 border-t border-landing-border-soft pt-7 font-mono text-[10.5px] uppercase tracking-wider text-landing-fg-faint md:flex-row md:items-center md:text-[11px]">
          <div>{welcomeT.contact.footerCopyright(COPYRIGHT_YEAR)}</div>
          <AvailabilityBadge suffix={welcomeT.hero.utc} />
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

export const Contact = memo(ContactComponent);
