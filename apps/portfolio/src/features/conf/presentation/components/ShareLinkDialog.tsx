import { useFunction } from '@frozik/components/hooks/useFunction';
import { Copy } from 'lucide-react';
import type { FocusEvent } from 'react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import { QRCode } from '../../../../shared/ui/QRCode';
import { confT } from '../translations';

export interface IShareLinkDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly url: string;
  readonly onCopy: () => void;
}

const QR_SIZE_PX = 200;
const COPY_ICON_SIZE_PX = 14;

const ShareLinkDialogComponent = ({ open, onClose, url, onCopy }: IShareLinkDialogProps) => {
  const handleInputFocus = useFunction((event: FocusEvent<HTMLInputElement>) => {
    event.target.select();
  });

  const footer = (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
        'border-0 bg-landing-accent text-landing-bg hover:bg-landing-accent/90'
      )}
    >
      {confT.share.done}
    </button>
  );

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={confT.share.dialogTitle}
      description={confT.share.description}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={url}
          readOnly
          onFocus={handleInputFocus}
          className={cn(
            'w-full border-0 border-b border-dashed border-landing-border-soft bg-transparent',
            'px-0 py-2 font-mono text-[13px] leading-[1.5] text-landing-fg',
            'focus:border-landing-accent focus:outline-none'
          )}
        />

        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
            'border border-landing-accent-dim text-landing-accent',
            'hover:border-landing-accent hover:bg-landing-accent/10'
          )}
        >
          <Copy size={COPY_ICON_SIZE_PX} />
          {confT.share.copyLink}
        </button>

        <div className="mt-2 flex flex-col items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-landing-fg-faint uppercase">
            {confT.share.qrLabel}
          </span>
          <div className="bg-white p-3">
            <QRCode size={QR_SIZE_PX} value={url} />
          </div>
        </div>
      </div>
    </DialogShell>
  );
};

export const ShareLinkDialog = memo(ShareLinkDialogComponent);
