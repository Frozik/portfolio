import { useFunction } from '@frozik/components/hooks/useFunction';
import { Check, Copy } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { QRCode } from '../../../../shared/ui/QRCode';
import { retroT as t } from '../translations';

const QR_PIXEL_SIZE_PX = 216;
const COPY_RESET_DELAY_MS = 1800;
const ICON_SIZE_PX = 12;

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  onCopy: () => void;
}

const ShareLinkDialogComponent = ({ open, onClose, url, onCopy }: ShareLinkDialogProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useFunction(() => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
  });

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      kicker={t.share.kicker}
      title={t.share.dialogTitle}
      description={t.share.description}
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            'rounded-sm border border-landing-border-soft bg-landing-bg-elev p-3',
            'break-all font-mono text-[12px] leading-[1.5] text-landing-fg-dim'
          )}
        >
          {url}
        </div>

        <div className="flex flex-col items-center gap-2">
          <MonoKicker tone="faint">{t.share.qrLabel}</MonoKicker>
          <div className="rounded-sm bg-white p-4">
            <QRCode value={url} size={QR_PIXEL_SIZE_PX} className="bg-transparent p-0" />
          </div>
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
              <Check size={ICON_SIZE_PX} /> {t.share.copied}
            </>
          ) : (
            <>
              <Copy size={ICON_SIZE_PX} /> {t.share.copyLink}
            </>
          )}
        </button>
      </div>
    </DialogShell>
  );
};

export const ShareLinkDialog = memo(ShareLinkDialogComponent);

export type { ShareLinkDialogProps };
