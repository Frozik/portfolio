import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import type { VaultSession } from '../../application/VaultSession';
import { cloudT } from '../translations/cloud';

/**
 * The cloud file opened, but it is another vault: never
 * merged in silence. Its name and cards stay unknown without its own
 * password, so the choice is this vault over it (an explicit overwrite), or
 * no cloud for this vault; the other one opens from the start screen.
 */
export const ForeignVaultDialog = observer(
  ({
    session,
    onDisconnect,
  }: {
    readonly session: VaultSession;
    readonly onDisconnect: () => void;
  }) => {
    const t = cloudT.foreign;
    const [dismissed, setDismissed] = useState(false);
    const [failed, setFailed] = useState(false);
    const { status, connection } = session.cloud;
    const open = !dismissed && status.kind === 'stopped' && status.reason.kind === 'foreign-vault';
    const replace = (): void => {
      setFailed(false);
      void session.cloud.replaceRemote().then(result => setFailed(!result.ok));
    };

    return (
      <DialogShell
        open={open}
        onClose={() => setDismissed(true)}
        title={t.title}
        description={t.description(connection?.location.path ?? '')}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={replace}>
              {t.replace}
            </Button>
            <Button type="button" variant="secondary" onClick={onDisconnect}>
              {cloudT.section.disconnect}
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-landing-fg-dim">{t.openOther}</p>
        {failed && <Alert type="error" message={t.replaceFailed} />}
      </DialogShell>
    );
  }
);
