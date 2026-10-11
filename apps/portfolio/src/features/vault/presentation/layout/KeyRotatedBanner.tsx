import { observer } from 'mobx-react-lite';

import { Alert } from '../../../../shared/ui/Alert';
import type { VaultSession } from '../../application/VaultSession';
import { PasswordAction } from '../components/PasswordAction';
import { rotationFailureText } from '../settings/rotation-failure-text';
import { keysT } from '../translations/keys';

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
        error={state.kind === 'failed' ? rotationFailureText(state.failure) : null}
        onSubmit={password => void session.rotation.follow(password)}
      />
    </div>
  );
});
