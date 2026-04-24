import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { DialogShell } from '../../../../shared/ui/DialogShell';

export interface IConfirmDialogProps {
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
}: IConfirmDialogProps) => {
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
          tone === 'danger'
            ? 'border-0 bg-landing-red text-landing-bg hover:bg-landing-red/90'
            : 'border-0 bg-landing-accent text-landing-bg hover:bg-landing-accent/90'
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
      title={title}
      description={description}
      closeLabel={cancelLabel}
      footer={footer}
    />
  );
};

export const ConfirmDialog = memo(ConfirmDialogComponent);
