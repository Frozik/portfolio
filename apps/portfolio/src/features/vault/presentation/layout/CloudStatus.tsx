import { assertNever } from '@frozik/utils/assert/assertNever';
import { RefreshCw } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { TCloudStatus } from '../../application/cloud-status';
import type { CloudLink } from '../../application/CloudLink';
import { vaultT } from '../translations';
import { cloudT } from '../translations/cloud';

const SYNC_ICON_SIZE = 14;

function statusText(status: Exclude<TCloudStatus, { readonly kind: 'none' }>): string {
  const t = cloudT.status;
  switch (status.kind) {
    case 'unreachable':
      return t.unreachable;
    case 'other-tab':
      return t.otherTab;
    case 'syncing':
      return t.syncing;
    case 'synced':
      return t.synced;
    case 'sign-in-needed':
      return t.signInNeeded;
    case 'offline':
      return t.offline;
    case 'waiting':
      return status.cause.kind === 'quota' ? t.quota : t.retrying;
    case 'stopped':
      return vaultT.status.stopped[status.reason.kind];
    default:
      return assertNever(status);
  }
}

/** The cloud's line in the header; Google's sign-in, when it expired, is one click here. */
export const CloudStatus = observer(({ cloud }: { readonly cloud: CloudLink }) => {
  const { status } = cloud;
  if (status.kind === 'none') {
    return null;
  }
  const trouble = status.kind === 'stopped' || status.kind === 'unreachable';
  const syncable =
    status.kind === 'synced' || status.kind === 'offline' || status.kind === 'waiting';
  return (
    <span className="flex items-center gap-2">
      <span className={trouble ? 'text-[12px] text-error' : 'text-[12px] text-landing-fg-faint'}>
        {statusText(status)}
      </span>
      {(syncable || status.kind === 'syncing') && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={cloudT.status.syncNow}
          title={cloudT.status.syncNow}
          disabled={!syncable}
          onClick={cloud.syncNow}
        >
          <RefreshCw
            size={SYNC_ICON_SIZE}
            className={status.kind === 'syncing' ? 'animate-spin' : undefined}
          />
        </Button>
      )}
      {status.kind === 'sign-in-needed' && (
        <Button type="button" size="sm" variant="secondary" onClick={() => void cloud.signIn()}>
          {cloudT.status.signIn}
        </Button>
      )}
    </span>
  );
});
