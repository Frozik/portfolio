import { toHex } from '@frozik/vault/crypto/bytes';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import type { PasskeyFlow } from '../../application/PasskeyFlow';
import type { SessionKeys } from '../../application/SessionKeys';
import type { TPasskeyFailure } from '../../domain/ports/passkeys';
import { PanelSection } from '../components/PanelSection';
import { PasswordAction } from '../components/PasswordAction';
import { vaultT } from '../translations';
import { keysT } from '../translations/keys';

const SHOWN_ID_CHARS = 8;

function failureText(failure: TPasskeyFailure | TUnlockFailure): string {
  switch (failure) {
    case 'unsupported':
    case 'cancelled':
    case 'no-prf':
    case 'failed':
      return keysT.passkeys.failures[failure];
    default:
      return vaultT.unlock.failures[failure];
  }
}

const AddPasskey = observer(({ flow }: { readonly flow: PasskeyFlow }) => {
  const t = keysT.passkeys;
  const { step } = flow;
  switch (step.kind) {
    case 'ready':
    case 'asking':
      return (
        <Button
          type="button"
          className="self-start"
          disabled={step.kind === 'asking'}
          onClick={() => void flow.create()}
        >
          {step.kind === 'asking' ? t.asking : t.create}
        </Button>
      );
    case 'added':
      return (
        <div className="flex flex-col gap-3">
          <Alert type="success" message={t.added} />
          <Button type="button" variant="secondary" className="self-start" onClick={flow.reset}>
            {t.again}
          </Button>
        </div>
      );
    default:
      return (
        <PasswordAction
          label={t.password}
          submitLabel={t.check}
          workingLabel={t.checking}
          working={step.kind === 'checking'}
          error={step.kind === 'failed' ? failureText(step.failure) : null}
          onSubmit={password => {
            flow.setPassword(password);
            void flow.checkPassword();
          }}
        />
      );
  }
});

/** The passkeys that open the vault, and adding one of this device. */
export const PasskeysPanel = observer(
  ({ flow, keys }: { readonly flow: PasskeyFlow; readonly keys: SessionKeys }) => {
    const t = keysT.passkeys;
    const [supported, setSupported] = useState<boolean | null>(null);
    useEffect(() => {
      void flow.supported().then(setSupported);
    }, [flow]);
    return (
      <PanelSection title={t.title}>
        <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
        {keys.passkeys.length === 0 ? (
          <p className="text-[13px] text-landing-fg-faint">{t.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.passkeys.map((credentialId, index) => {
              const id = toHex(credentialId);
              return (
                <li key={id} className="flex items-center gap-3 text-[13px] text-landing-fg">
                  {t.item(index + 1, id.slice(0, SHOWN_ID_CHARS))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => flow.remove(credentialId)}
                  >
                    {t.remove}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {supported === false ? (
          <p className="text-[13px] text-landing-fg-faint">{t.unsupported}</p>
        ) : (
          <AddPasskey flow={flow} />
        )}
      </PanelSection>
    );
  }
);
