import { cn } from '@frozik/components/components/cn';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { SENSITIVE_CLASS } from '@frozik/vault/react/sensitive-class';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import type { RecoveryKeyFlow } from '../../application/RecoveryKeyFlow';
import type { VaultFeatureStore } from '../../application/VaultFeatureStore';
import type { VaultSession } from '../../application/VaultSession';
import { PanelSection } from '../components/PanelSection';
import { VaultField } from '../components/VaultField';
import { createEmergencyKitRenderer } from '../emergency-kit/render-emergency-kit';
import { vaultT } from '../translations';
import { keysT } from '../translations/keys';
import { locationText } from './location-text';

const KitButton = observer(({ flow }: { readonly flow: RecoveryKeyFlow }) => {
  const t = keysT.recoveryKey;
  const { kit } = flow;
  switch (kit.kind) {
    case 'making':
      return <p className="text-[13px] text-landing-fg-dim">{t.kitMaking}</p>;
    case 'ready':
      return (
        <Button type="button" className="self-start" onClick={flow.saveKit}>
          {t.saveKit}
        </Button>
      );
    case 'failed':
      return <Alert type="warning" message={t.kitFailed} />;
    default:
      return assertNever(kit);
  }
});

const Confirmation = observer(({ flow }: { readonly flow: RecoveryKeyFlow }) => {
  const t = keysT.recoveryKey;
  const { step } = flow;
  const confirm = (): void => void flow.confirm();
  const failure = step.kind === 'confirming' ? step.failure : null;
  return (
    <div className="flex flex-col gap-4">
      <VaultField label={t.lastGroup} hint={t.lastGroupHint}>
        {describedBy => (
          <TextEditor
            aria-label={t.lastGroup}
            aria-describedby={describedBy}
            value={flow.lastGroup}
            onValueChange={flow.setLastGroup}
          />
        )}
      </VaultField>
      <VaultField
        label={t.password}
        error={isNil(failure) ? null : vaultT.unlock.failures[failure]}
      >
        {describedBy => (
          <SecretEditor
            aria-label={t.password}
            aria-describedby={describedBy}
            autoComplete="current-password"
            value={flow.password}
            onValueChange={flow.setPassword}
            onEnter={confirm}
            locale={getCurrentLanguage()}
          />
        )}
      </VaultField>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!flow.canConfirm || step.kind === 'saving'}
          onClick={confirm}
        >
          {step.kind === 'saving' ? t.saving : t.confirm}
        </Button>
        <Button type="button" variant="ghost" onClick={flow.cancel}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
});

const FlowBody = observer(
  ({ flow, hasKey }: { readonly flow: RecoveryKeyFlow; readonly hasKey: boolean }) => {
    const t = keysT.recoveryKey;
    const { step } = flow;
    switch (step.kind) {
      case 'idle':
        return (
          <Button type="button" variant="secondary" className="self-start" onClick={flow.start}>
            {hasKey ? t.replace : t.create}
          </Button>
        );
      case 'shown':
        return (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-landing-fg-dim">{t.shown}</p>
            <code
              className={cn(
                SENSITIVE_CLASS,
                'self-start rounded-md bg-black/40 px-4 py-3 font-mono text-[17px] tracking-wider text-landing-fg'
              )}
            >
              {step.formatted}
            </code>
            <KitButton flow={flow} />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={flow.toConfirmation}>
                {t.written}
              </Button>
              <Button type="button" variant="ghost" onClick={flow.cancel}>
                {t.cancel}
              </Button>
            </div>
          </div>
        );
      case 'confirming':
      case 'saving':
        return <Confirmation flow={flow} />;
      case 'done':
        return <Alert type="success" message={t.done} data-testid="recovery-key-on" />;
      default:
        return assertNever(step);
    }
  }
);

/**
 * The recovery key: made here, shown once
 * with its Emergency Kit, turned on only once its last group is typed back.
 */
export const RecoveryKeyPanel = observer(
  ({ store, session }: { readonly store: VaultFeatureStore; readonly session: VaultSession }) => {
    const t = keysT.recoveryKey;
    const [flow] = useState(() =>
      store.recoveryKeyOf(
        session,
        createEmergencyKitRenderer({
          vaultName: session.document.settings.name,
          location: locationText(session.cloud.location),
        })
      )
    );
    useEffect(() => flow.dispose, [flow]);
    return (
      <PanelSection title={t.title}>
        <p className="text-[13px] text-landing-fg-dim">
          {session.keys.hasRecoveryKey ? t.present : t.none}
        </p>
        <FlowBody flow={flow} hasKey={session.keys.hasRecoveryKey} />
      </PanelSection>
    );
  }
);
