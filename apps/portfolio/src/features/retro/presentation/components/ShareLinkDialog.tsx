import { useFunction } from '@frozik/components';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Copy } from 'lucide-react';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { retroT as t } from '../translations';

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  onCopy: () => void;
}

const ShareLinkDialogComponent = ({ open, onClose, url, onCopy }: ShareLinkDialogProps) => {
  const handleOpenChange = useFunction((nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  });

  const handleInputFocus = useFunction((event: React.FocusEvent<HTMLInputElement>) => {
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
            {t.share.dialogTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
            {t.share.description}
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
              {t.share.copyLink}
            </Button>
          </div>

          <div className="mt-6 flex justify-end">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="primary">
                {t.share.done}
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const ShareLinkDialog = memo(ShareLinkDialogComponent);

export type { ShareLinkDialogProps };
