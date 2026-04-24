import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import { retroT as t } from '../translations';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly tone?: 'neutral' | 'danger';
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const ConfirmDialogComponent = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'neutral',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const isDanger = tone === 'danger';

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
          'inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'border-0',
          isDanger
            ? 'bg-landing-red text-white hover:bg-landing-red/90'
            : 'bg-landing-accent text-landing-bg hover:bg-landing-accent/90'
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
      kicker={t.confirm.kicker}
      title={title}
      description={description}
      closeLabel={cancelLabel}
      footer={footer}
    />
  );
};

export const ConfirmDialog = memo(ConfirmDialogComponent);

export type { ConfirmDialogProps };
