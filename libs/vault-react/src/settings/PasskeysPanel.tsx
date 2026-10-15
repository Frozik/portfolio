import { toHex } from '@frozik/vault/crypto/bytes';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { PasskeyFlow } from '@frozik/vault-app/keys/application/PasskeyFlow';
import type { SessionKeys } from '@frozik/vault-app/keys/application/SessionKeys';
import { passkeyFailureText } from '@frozik/vault-app/texts/keys/keys-wording';
import { PanelSection } from '../form/PanelSection';
import { PasswordAction } from '../form/PasswordAction';
import { keysT } from '../texts/keys';
import { vaultT } from '../texts/vault';

const SHOWN_ID_CHARS = 8;

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
          data-testid="passkey-create"
          onClick={() => void flow.create()}
        >
          {step.kind === 'asking' ? t.asking : t.create}
        </Button>
      );
    case 'added':
      return (
        <div className="flex flex-col gap-3">
          <Alert type="success" message={t.added} data-testid="passkey-added" />
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
          error={
            step.kind === 'failed'
              ? passkeyFailureText({ keys: keysT, vault: vaultT }, step.failure)
              : null
          }
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
      void flow.capabilities().then(capabilities => setSupported(capabilities.prf));
    }, [flow]);
    return (
      <div data-testid="passkeys">
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
      </div>
    );
  }
);
