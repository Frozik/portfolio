import { useFunction } from '@frozik/components';
import { Download, Mail, MessageCircle } from 'lucide-react';
import { memo } from 'react';
import { SvgGitHub } from '../../../../icons/SvgGitHub';
import { SvgLinkedIn } from '../../../../icons/SvgLinkedIn';
import { SvgTelegram } from '../../../../icons/SvgTelegram';
import { Button, QRCode, Tooltip } from '../../../../shared/ui';
import styles from '../styles.module.scss';
import { getAge } from '../utils';

export const Contacts = memo(() => {
  const handlePrint = useFunction(() => window.print());

  return (
    <div>
      <h2>
        Sharov Dmitry Nikolaevich{' '}
        <Button variant="link" className="print:hidden" onClick={handlePrint}>
          <Download size={14} />
          Save PDF
        </Button>
      </h2>

      <p>Male, {getAge()} years, born on 10 November 1982</p>

      <address className={styles.infoBlock}>
        <ul>
          <li>
            <Tooltip
              title={
                <div className="hidden md:block">
                  <QRCode size={256} value="https://t.me/Frozik" />
                </div>
              }
            >
              <a
                href="https://t.me/Frozik"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <SvgTelegram className="fill-white print:fill-black" />
                <span className="font-mono">@Frozik</span>
              </a>
            </Tooltip>
            — preferred means of communication
          </li>
          <li>
            <Tooltip
              title={
                <div className="hidden md:block">
                  <QRCode size={256} value="https://wa.me/qr/TCOFX34ZSPXDN1" />
                </div>
              }
            >
              <a
                href="https://wa.me/79817151041"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <MessageCircle size={14} />
                <span className="font-mono">Dmitry Sharov</span>
              </a>
            </Tooltip>
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
              <span className="font-mono">frozik</span>
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
              <span className="font-mono">frozik</span>
            </a>
          </li>
        </ul>
      </address>

      <aside className={styles.infoBlock}>
        <p>Reside in: Saint Petersburg, metro station Komendantskiy Prospekt</p>
        <p>Citizenship: Russia, work permit at: Russia</p>
        <p>I am not ready to relocate, but I am open to occasional business trips.</p>
      </aside>
    </div>
  );
});
