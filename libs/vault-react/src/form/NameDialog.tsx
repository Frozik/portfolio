import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { vaultT } from '../texts/vault';

/** A name asked for in a dialog — a new group, a template — trimmed, never empty. */
export function NameDialog({
  title,
  label,
  confirmLabel,
  initial = '',
  onSubmit,
  onClose,
}: {
  readonly title: string;
  readonly label: string;
  readonly confirmLabel: string;
  readonly initial?: string;
  readonly onSubmit: (name: string) => void;
  readonly onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const submit = useEventCallback(() => {
    const trimmed = name.trim();
    if (trimmed !== '') {
      onSubmit(trimmed);
      onClose();
    }
  });

  return (
    <DialogShell
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {vaultT.menu.cancel}
          </Button>
          <Button type="button" disabled={name.trim() === ''} onClick={submit}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <TextEditor aria-label={label} value={name} onValueChange={setName} enterKeyHint="done" />
    </DialogShell>
  );
}
