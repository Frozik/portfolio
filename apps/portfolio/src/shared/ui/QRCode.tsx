import { cn } from '@frozik/components/components/cn';
import { QRCodeSVG } from 'qrcode.react';
import { memo } from 'react';

const DEFAULT_QR_SIZE = 128;

export const QRCode = memo(
  ({
    value,
    size = DEFAULT_QR_SIZE,
    className,
  }: {
    value: string;
    size?: number;
    className?: string;
  }) => (
    <div className={cn('inline-flex rounded-lg bg-white p-2', className)}>
      <QRCodeSVG value={value} size={size} />
    </div>
  )
);
