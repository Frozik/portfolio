import { useFunction } from '@frozik/components/hooks/useFunction';
import { Check } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../../shared/lib/cn';
import { Modal } from '../../../../../shared/ui/Modal';
import { QRCode } from '../../../../../shared/ui/QRCode';
import { welcomeT } from '../../translations';

const QR_PIXEL_SIZE_PX = 216;
const COPY_RESET_DELAY_MS = 1800;
const ICON_SIZE_PX = 12;

type QRContactModalProps = {
  readonly open: boolean;
  readonly value: string;
  readonly title: string;
  readonly onClose: () => void;
};

const QRContactModalComponent = ({ open, value, title, onClose }: QRContactModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useFunction(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
    } catch {
      // Silently ignore clipboard failures — older browsers, cross-origin iframes, etc.
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={welcomeT.contacts.qrLinkLabel}
      closeLabel={welcomeT.nav.closeQR}
    >
      <div className="mb-5 flex justify-center rounded-sm bg-white p-4">
        <QRCode value={value} size={QR_PIXEL_SIZE_PX} className="bg-transparent p-0" />
      </div>
      <div className="mb-4 break-all font-mono text-[12px] leading-[1.5] text-landing-fg-dim">
        {value}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'flex w-full items-center justify-center gap-3 rounded-[2px] border px-4 py-3',
          'font-mono text-[11px] uppercase tracking-widest transition-colors',
          'border-landing-accent-dim text-landing-accent',
          'hover:border-landing-accent hover:bg-landing-accent/10'
        )}
      >
        {copied ? (
          <>
            <Check size={ICON_SIZE_PX} /> {welcomeT.contacts.copied}
          </>
        ) : (
          welcomeT.contacts.copyLink
        )}
      </button>
    </Modal>
  );
};

export const QRContactModal = memo(QRContactModalComponent);
