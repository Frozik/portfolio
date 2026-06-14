import { memo } from 'react';

import { cn } from '../lib/cn';
import { DialogShell } from './DialogShell';

/**
 * Confirm/cancel dialog over the shared {@link DialogShell}. Used by retro and
 * conf for destructive (`tone="danger"`) and neutral confirmations — texts are
 * passed in so each feature keeps its own translations.
 */
const ConfirmDialogComponent = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'neutral',
  kicker,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly tone?: 'neutral' | 'danger';
  /** Optional mono kicker shown above the title (e.g. "CONFIRM"). */
  readonly kicker?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  const footer = (
    <>
      <button
        type="button"
        onClick={onCancel}
        className={cn(
          'px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'text-landing-fg-dim hover:text-landing-fg'
        )}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={cn(
          'inline-flex items-center gap-1.5 border-0 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-landing-bg transition-colors',
          tone === 'danger'
            ? 'bg-landing-red hover:bg-landing-red/90'
            : 'bg-landing-accent hover:bg-landing-accent/90'
        )}
      >
        {confirmLabel}
      </button>
    </>
  );

  return (
    <DialogShell
      open={open}
      onClose={onCancel}
      kicker={kicker}
      title={title}
      description={description}
      closeLabel={cancelLabel}
      footer={footer}
    />
  );
};

export const ConfirmDialog = memo(ConfirmDialogComponent);
