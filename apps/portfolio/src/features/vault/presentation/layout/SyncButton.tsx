import { RefreshCw } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '@frozik/components/ui/Button';
import type { CloudLink } from '@frozik/vault-app/cloud/application/CloudLink';
import { cloudT } from '@frozik/vault-react/texts/cloud';

const SYNC_ICON_SIZE = 14;

/**
 * "Sync now" in the sections' column: shown for a vault kept in a cloud
 * whose sync this tab runs; it spins while a cycle runs and waits out a
 * stop the user has to decide about.
 */
export const SyncButton = observer(({ cloud }: { readonly cloud: CloudLink }) => {
  const { status } = cloud;
  const syncable =
    status.kind === 'synced' || status.kind === 'offline' || status.kind === 'waiting';
  if (!syncable && status.kind !== 'syncing') {
    return null;
  }
  return (
    <div className="mt-3 flex flex-col border-t border-landing-border-soft pt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start"
        title={cloudT.status.syncNow}
        disabled={!syncable}
        onClick={cloud.syncNow}
      >
        <RefreshCw
          size={SYNC_ICON_SIZE}
          className={status.kind === 'syncing' ? 'animate-spin' : undefined}
        />
        {cloudT.status.sync}
      </Button>
    </div>
  );
});
