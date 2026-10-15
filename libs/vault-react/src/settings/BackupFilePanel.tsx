import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { VaultBackupFile } from '@frozik/vault-app/interchange/application/VaultBackupFile';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { settingsT } from '../texts/settings';

const Step = observer(({ backup }: { readonly backup: VaultBackupFile }) => {
  const t = settingsT.backups.file;
  const { step } = backup;
  switch (step.kind) {
    case 'idle':
    case 'preparing':
      return (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          data-testid="backup-file-prepare"
          disabled={step.kind === 'preparing'}
          onClick={() => void backup.prepare()}
        >
          {step.kind === 'preparing' ? t.preparing : t.prepare}
        </Button>
      );
    case 'ready':
      return (
        <Button
          type="button"
          className="self-start"
          data-testid="backup-file-save"
          onClick={() => void backup.save()}
        >
          {t.save}
        </Button>
      );
    case 'saved':
      return (
        <div className="flex flex-col gap-3">
          <Alert type="success" message={t.saved} data-testid="backup-file-saved" />
          <Button type="button" variant="ghost" className="self-start" onClick={backup.reset}>
            {t.again}
          </Button>
        </div>
      );
    case 'unreadable':
      return <Alert type="error" message={t.unreadable} />;
    default:
      return assertNever(step);
  }
});

/** The vault file itself, saved wherever the user keeps backups. */
export const BackupFilePanel = observer(({ session }: { readonly session: VaultSession }) => {
  const t = settingsT.backups.file;
  const [backup] = useState(() => session.flows.backupFileOf());
  useEffect(() => backup.dispose, [backup]);
  return (
    <div className="flex flex-col gap-3" data-testid="backup-file">
      <h4 className="text-[14px] font-medium text-landing-fg">{t.title}</h4>
      <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
      {backup.leavesOutBigFiles && <Alert type="info" message={t.bigFiles} />}
      <Step backup={backup} />
    </div>
  );
});
