import { memo } from 'react';

import { DialogShell } from '../../shared/ui/DialogShell';
import { QRCode } from '../../shared/ui/QRCode';
import { appT } from '../translations';

const QR_SIZE_PX = 216;

const TopNavQrDialogComponent = ({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) => {
  const pageUrl = window.location.href;

  return (
    <DialogShell
      compact
      open={open}
      onClose={onClose}
      title={appT.nav.openOnPhone}
      description="URL"
      closeLabel={appT.nav.closeQR}
    >
      <div className="mb-5 flex justify-center rounded-sm bg-white p-4">
        <QRCode value={pageUrl} size={QR_SIZE_PX} className="bg-transparent p-0" />
      </div>
      <div className="break-all font-mono text-[12px] leading-[1.5] text-landing-fg-dim">
        {pageUrl}
      </div>
    </DialogShell>
  );
};

export const TopNavQrDialog = memo(TopNavQrDialogComponent);
