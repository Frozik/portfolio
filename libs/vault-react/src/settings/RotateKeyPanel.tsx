import { observer } from 'mobx-react-lite';

import type { KeyRotation } from '@frozik/vault-app/keys/application/KeyRotation';
import { rotationFailureText } from '@frozik/vault-app/texts/keys/keys-wording';
import { PanelSection } from '../form/PanelSection';
import { PasswordAction } from '../form/PasswordAction';
import { keysT } from '../texts/keys';
import { vaultT } from '../texts/vault';

/** Everything under a new key, with what that costs said up front. */
export const RotateKeyPanel = observer(({ rotation }: { readonly rotation: KeyRotation }) => {
  const t = keysT.rotation;
  const { state } = rotation;
  return (
    <PanelSection title={t.title}>
      <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-landing-fg-dim">
        {t.consequences.map(consequence => (
          <li key={consequence}>{consequence}</li>
        ))}
      </ul>
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
        onSubmit={password => void rotation.rotate(password)}
      />
    </PanelSection>
  );
});
