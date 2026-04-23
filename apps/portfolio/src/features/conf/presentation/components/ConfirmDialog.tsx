import { useFunction } from '@frozik/components';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { memo } from 'react';

import { Button } from '../../../../shared/ui';

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

const CLOSE_ICON_SIZE = 16;

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
  const handleOpenChange = useFunction((nextOpen: boolean) => {
    if (!nextOpen) {
      onCancel();
    }
  });

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-border bg-surface p-5 text-text shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-text">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={cancelLabel}
                className="text-text-secondary hover:text-text"
              >
                <X size={CLOSE_ICON_SIZE} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-text-secondary">
            {description}
          </Dialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              size="sm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const ConfirmDialog = memo(ConfirmDialogComponent);
