import { useFunction } from '@frozik/components/hooks/useFunction';
import { memo } from 'react';

import { cn } from '../../../../../shared/lib/cn';
import { welcomeT } from '../../translations';
import type { TContactIconKey } from './ContactIcon';
import { ContactIcon } from './ContactIcon';

const ICON_SIZE_PX = 16;

export interface IContactQRRequest {
  readonly value: string;
  readonly title: string;
}

type ContactRowProps = {
  readonly iconKey: TContactIconKey;
  readonly label: string;
  readonly href: string;
  readonly qrValue?: string;
  readonly qrTitle?: string;
  readonly preferred?: boolean;
  readonly preferredLabel?: string;
  readonly onQRRequest?: (payload: IContactQRRequest) => void;
};

function MiniQR({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <path d="M14 14h3v3M17 19h1M20 14v1M20 17v4M14 19h1" />
    </svg>
  );
}

const ContactRowComponent = ({
  iconKey,
  label,
  href,
  qrValue,
  qrTitle,
  preferred,
  preferredLabel = welcomeT.contacts.preferredLabel,
  onQRRequest,
}: ContactRowProps) => {
  const isMailto = href.startsWith('mailto:');

  const handleQRClick = useFunction(() => {
    if (!onQRRequest || !qrValue || !qrTitle) {
      return;
    }
    onQRRequest({ value: qrValue, title: qrTitle });
  });

  return (
    <div
      className={cn('group flex items-center gap-3 py-1.5', iconKey !== 'email' && 'print:hidden')}
    >
      <a
        href={href}
        target={isMailto ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 text-landing-fg-dim transition-colors hover:text-landing-fg"
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
            'border border-landing-border bg-landing-bg-card text-landing-fg-dim',
            'transition-colors group-hover:border-landing-accent/60 group-hover:text-landing-accent'
          )}
        >
          <ContactIcon iconKey={iconKey} size={ICON_SIZE_PX} />
        </span>
        <span className="min-w-0 truncate">{label}</span>
        {preferred && (
          <span className="shrink-0 rounded-sm border border-landing-accent/40 bg-landing-accent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-landing-accent">
            {preferredLabel}
          </span>
        )}
      </a>
      {qrValue && onQRRequest && (
        <button
          type="button"
          onClick={handleQRClick}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
            'border border-landing-border text-landing-fg-faint',
            'transition-colors hover:border-landing-accent hover:bg-landing-accent/10 hover:text-landing-accent',
            'print:hidden'
          )}
          aria-label={welcomeT.contacts.showQRFor(label)}
          title={welcomeT.contacts.openQR}
        >
          <MiniQR className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export const ContactRow = memo(ContactRowComponent);
