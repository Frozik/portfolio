import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { ConfirmDialog } from '@frozik/components/ui/ConfirmDialog';
import { settingsT } from '../texts/settings';

/** "Delete from this device", after a confirmation that says what stays in a cloud. */
export function ForgetVaultButton({ onForget }: { readonly onForget: () => void }) {
  const t = settingsT;
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="danger"
        className="self-start"
        data-testid="forget-vault"
        onClick={() => setConfirming(true)}
      >
        {t.forget}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={t.forgetTitle}
        description={t.forgetMessage}
        confirmLabel={t.forgetConfirm}
        cancelLabel={t.cancel}
        tone="danger"
        onConfirm={() => {
          setConfirming(false);
          onForget();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
