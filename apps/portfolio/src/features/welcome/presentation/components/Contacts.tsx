import { useFunction } from '@frozik/components';
import { Download, Mail, MessageCircle } from 'lucide-react';
import { memo } from 'react';
import { SvgGitHub } from '../../../../icons/SvgGitHub';
import { SvgLinkedIn } from '../../../../icons/SvgLinkedIn';
import { SvgTelegram } from '../../../../icons/SvgTelegram';
import { Button, QRCodePopover } from '../../../../shared/ui';
import { getAge } from '../../utils';
import { welcomeT } from '../translations';
import { AvailabilityStatus } from './AvailabilityStatus';

export const Contacts = memo(() => {
  const handlePrint = useFunction(() => window.print());

  return (
    <div>
      <h2 className="flex flex-wrap items-baseline gap-x-2">
        <span>{welcomeT.contacts.fullName}</span>
        <Button variant="link" className="px-0 print:hidden" onClick={handlePrint}>
          <Download size={14} />
          {welcomeT.contacts.savePdf}
        </Button>
      </h2>

      <p>{welcomeT.contacts.personalInfo(getAge())}</p>

      <address className="text-left not-italic [&_a]:text-white [&_a]:print:text-black [&_a]:print:no-underline [&_p]:mb-0">
        <ul>
          <li>
            <QRCodePopover value="https://t.me/Frozik">
              <a
                href="https://t.me/Frozik"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <SvgTelegram className="fill-white print:fill-black" />
                <span className="font-mono">@Frozik</span>
              </a>
            </QRCodePopover>
            {welcomeT.contacts.preferredContact}
          </li>
          <li>
            <QRCodePopover value="https://wa.me/qr/TCOFX34ZSPXDN1">
              <a
                href="https://wa.me/79817151041"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <MessageCircle size={14} />
                <span className="font-mono">Dmitry Sharov</span>
              </a>
            </QRCodePopover>
          </li>
          <li>
            <a href="mailto:frozik@gmail.com" className="inline-flex items-center gap-1.5">
              <Mail size={14} />
              <span className="font-mono">frozik@gmail.com</span>
            </a>
          </li>
          <li>
            <a
              href="https://github.com/frozik"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <SvgGitHub width={14} height={14} />
              <span className="font-mono">Frozik</span>
            </a>
          </li>
          <li>
            <a
              href="https://linkedin.com/in/frozik"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <SvgLinkedIn width={14} height={14} />
              <span className="font-mono">Frozik</span>
            </a>
          </li>
        </ul>
      </address>

      <AvailabilityStatus className="mt-2 flex flex-wrap items-center gap-x-2 text-sm" />
    </div>
  );
});
