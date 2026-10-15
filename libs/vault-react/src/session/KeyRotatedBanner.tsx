import { observer } from 'mobx-react-lite';

import { Alert } from '@frozik/components/ui/Alert';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { rotationFailureText } from '@frozik/vault-app/texts/keys/keys-wording';
import { PasswordAction } from '../form/PasswordAction';
import { keysT } from '../texts/keys';
import { vaultT } from '../texts/vault';

/** The cloud file is under a key this session lacks: the password follows it, edits made meanwhile included. */
export const KeyRotatedBanner = observer(({ session }: { readonly session: VaultSession }) => {
  const { status } = session.cloud;
  if (status.kind !== 'stopped' || status.reason.kind !== 'key-rotated') {
    return null;
  }
  const t = keysT.following;
  const { state } = session.rotation;
  return (
    <div className="flex max-w-[560px] flex-col gap-3">
      <Alert type="warning" message={t.message} description={t.description} />
      <PasswordAction
        label={t.password}
        submitLabel={t.submit}
        workingLabel={t.working}
        working={state.kind === 'working'}
        error={
          state.kind === 'failed'
            ? rotationFailureText({ keys: keysT, vault: vaultT }, state.failure)
            : null
        }
        onSubmit={password => void session.rotation.follow(password)}
      />
    </div>
  );
});
