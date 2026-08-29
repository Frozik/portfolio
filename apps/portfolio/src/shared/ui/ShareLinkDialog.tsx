import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { Check, Copy, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { memo } from 'react';
import type { TCopyStatus } from '../hooks/useCopyToClipboard';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { DialogShell } from './DialogShell';
import { MonoKicker } from './MonoKicker';
import { QRCode } from './QRCode';

const QR_PIXEL_SIZE_PX = 216;
const ICON_SIZE_PX = 12;

/**
 * Share-by-link dialog over the shared {@link DialogShell}: the URL, a QR code,
 * and a copy button that reports the outcome of the clipboard write inline
 * (tick on success, cross on failure) before falling back to its idle label.
 * Texts are passed in so each feature keeps its own translations; `onCopyResult`
 * lets a feature mirror the outcome in its own toast surface.
 */
const ShareLinkDialogComponent = ({
  open,
  onClose,
  url,
  onCopyResult,
  title,
  description,
  kicker,
  qrLabel,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly url: string;
  readonly onCopyResult?: (succeeded: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly kicker: string;
  readonly qrLabel: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
  readonly copyFailedLabel: string;
}) => {
  const { status, copy } = useCopyToClipboard();

  const handleCopy = useFunction(async () => {
    const succeeded = await copy(url);
    onCopyResult?.(succeeded);
  });

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      kicker={kicker}
      title={title}
      description={description}
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
          <MonoKicker tone="faint">{qrLabel}</MonoKicker>
          <div className="rounded-sm bg-white p-4">
            <QRCode value={url} size={QR_PIXEL_SIZE_PX} className="bg-transparent p-0" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          className={cn(
            'flex w-full items-center justify-center gap-3 rounded-[2px] border px-4 py-3',
            'font-mono text-[11px] uppercase tracking-widest transition-colors',
            status === 'failed'
              ? 'border-landing-red/40 text-landing-red'
              : cn(
                  'border-landing-accent-dim text-landing-accent',
                  'hover:border-landing-accent hover:bg-landing-accent/10'
                )
          )}
        >
          <CopyButtonContent
            status={status}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            copyFailedLabel={copyFailedLabel}
          />
        </button>
      </div>
    </DialogShell>
  );
};

const CopyButtonContent = ({
  status,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  readonly status: TCopyStatus;
  readonly copyLabel: string;
  readonly copiedLabel: string;
  readonly copyFailedLabel: string;
}): ReactElement => {
  switch (status) {
    case 'copied':
      return (
        <>
          <Check size={ICON_SIZE_PX} /> {copiedLabel}
        </>
      );
    case 'failed':
      return (
        <>
          <X size={ICON_SIZE_PX} /> {copyFailedLabel}
        </>
      );
    case 'idle':
      return (
        <>
          <Copy size={ICON_SIZE_PX} /> {copyLabel}
        </>
      );
    default:
      return assertNever(status);
  }
};

export const ShareLinkDialog = memo(ShareLinkDialogComponent);
