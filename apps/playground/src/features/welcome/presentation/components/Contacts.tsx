import { ExternalLink, Mail, MessageCircle } from 'lucide-react';
import { memo } from 'react';
import cvUrl from '../../../../assets/Sharov_Dmitry_Nikolaevich.pdf';
import { SvgTelegram } from '../../../../icons/SvgTelegram';
import { Button, QRCode, Tooltip } from '../../../../shared/ui';
import styles from '../styles.module.scss';
import { getAge } from '../utils';

export const Contacts = memo(() => (
  <div>
    <h2>
      Sharov Dmitry Nikolaevich{' '}
      <Button variant="link" asChild>
        <a href={cvUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          PDF
        </a>
      </Button>
    </h2>

    <p>Male, {getAge()} years, born on 10 November 1982</p>

    <address className={styles.infoBlock}>
      <ul>
        <li>
          <Tooltip title={<QRCode size={256} value="https://t.me/Frozik" />}>
            <a
              href="https://t.me/Frozik"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <SvgTelegram style={{ fill: '#ffffff' }} />
              @Frozik
            </a>
          </Tooltip>
          — preferred means of communication
        </li>
        <li>
          <Tooltip title={<QRCode size={256} value="https://wa.me/qr/TCOFX34ZSPXDN1" />}>
            <a
              href="https://wa.me/79817151041"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <MessageCircle size={14} />
              Dmitry Sharov
            </a>
          </Tooltip>
        </li>
        <li>
          <a href="mailto:frozik@gmail.com" className="inline-flex items-center gap-1.5">
            <Mail size={14} />
            frozik@gmail.com
          </a>
        </li>
        <li>
          <a
            href="https://github.com/frozik"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            frozik
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
));
