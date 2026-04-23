import { useFunction } from '@frozik/components';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Copy } from 'lucide-react';
import type { FocusEvent } from 'react';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { QRCode } from '../../../../shared/ui/QRCode';
import { confT } from '../translations';

export interface IShareLinkDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly url: string;
  readonly onCopy: () => void;
}

const QR_SIZE_PX = 200;

const ShareLinkDialogComponent = ({ open, onClose, url, onCopy }: IShareLinkDialogProps) => {
  const handleOpenChange = useFunction((nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  });

  const handleInputFocus = useFunction((event: FocusEvent<HTMLInputElement>) => {
    event.target.select();
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          }
        />
        <DialogPrimitive.Content
          className={
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 ' +
            'rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 ' +
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'
          }
        >
          <DialogPrimitive.Title className="text-lg font-semibold text-text">
            {confT.share.dialogTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
            {confT.share.description}
          </DialogPrimitive.Description>

          <div className="mt-5 flex flex-col gap-3">
            <input
              type="text"
              value={url}
              readOnly
              onFocus={handleInputFocus}
              className={
                'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text ' +
                'focus:outline-none focus:ring-2 focus:ring-brand-500'
              }
            />

            <Button type="button" variant="secondary" onClick={onCopy}>
              <Copy size={16} />
              {confT.share.copyLink}
            </Button>

            <div className="mt-2 flex flex-col items-center gap-2">
              <span className="text-xs text-text-muted">{confT.share.qrLabel}</span>
              <div className="rounded-md bg-white p-3">
                <QRCode size={QR_SIZE_PX} value={url} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="primary">
                {confT.share.done}
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const ShareLinkDialog = memo(ShareLinkDialogComponent);
