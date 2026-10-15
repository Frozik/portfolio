import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';

import { Button } from '@frozik/components/ui/Button';
import type { CloudLink } from '@frozik/vault-app/cloud/application/CloudLink';
import { cloudStatusText } from '@frozik/vault-app/texts/cloud/cloud-wording';
import { cloudT } from '@frozik/vault-react/texts/cloud';
import { vaultT } from '@frozik/vault-react/texts/vault';

/** The cloud's state in a word; Google's sign-in, when it expired, is one tap here. */
export const SyncChip = observer(({ cloud }: { readonly cloud: CloudLink }) => {
  const { status } = cloud;
  if (status.kind === 'none') {
    return null;
  }
  const trouble = status.kind === 'stopped' || status.kind === 'unreachable';
  return (
    <span className="flex items-center gap-2" data-testid="cloud-status" data-state={status.kind}>
      <span className={cn('text-[12px]', trouble ? 'text-danger' : 'text-fg-faint')}>
        {cloudStatusText({ cloud: cloudT, vault: vaultT }, status)}
      </span>
      {status.kind === 'sign-in-needed' && (
        <Button type="button" size="sm" variant="secondary" onClick={() => void cloud.signIn()}>
          {cloudT.status.signIn}
        </Button>
      )}
    </span>
  );
});
