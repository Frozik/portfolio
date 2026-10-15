import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { RadioGroup } from '@frozik/components/ui/RadioGroup';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { QuickUnlockSetup } from '@frozik/vault-app/keys/application/QuickUnlockSetup';
import type { TQuickUnlockKind } from '@frozik/vault-app/keys/domain/quick-code';
import { QUICK_LIFETIME_CHOICES } from '@frozik/vault-app/keys/domain/quick-code';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { PatternPad } from '../pattern-pad/PatternPad';

import { PanelSection } from '../form/PanelSection';
import { PasswordAction } from '../form/PasswordAction';
import { keysT } from '../texts/keys';
import { LANGUAGE } from '../texts/language';
import { vaultT } from '../texts/vault';

const KINDS: readonly TQuickUnlockKind[] = ['pin', 'pattern', 'first-four', 'last-four'];
const HOUR_MS = 60 * 60 * 1000;

/** The PIN typed while setting up: any length from four to eight, so a field rather than the pad. */
const PinEntry = ({
  label,
  onNext,
}: {
  readonly label: string;
  readonly onNext: (digits: string) => void;
}) => {
  const [digits, setDigits] = useState('');
  const next = (): void => {
    onNext(digits);
    setDigits('');
  };
  return (
    <div className="flex items-center gap-3">
      <SecretEditor
        aria-label={label}
        autoComplete="off"
        value={digits}
        onValueChange={setDigits}
        onEnter={next}
        locale={LANGUAGE}
      />
      <Button type="button" disabled={digits === ''} onClick={next}>
        {keysT.quick.next}
      </Button>
    </div>
  );
};

const SetupSteps = observer(({ setup }: { readonly setup: QuickUnlockSetup }) => {
  const t = keysT.quick;
  const { step } = setup;
  switch (step.kind) {
    case 'password':
    case 'checking':
      return (
        <PasswordAction
          label={t.password}
          submitLabel={t.check}
          workingLabel={t.checking}
          working={step.kind === 'checking'}
          error={
            step.kind === 'password' && !isNil(step.failure)
              ? vaultT.unlock.failures[step.failure]
              : null
          }
          onSubmit={password => void setup.checkPassword(password)}
        />
      );
    case 'choose':
      return (
        <div className="flex flex-col gap-2" data-testid="quick-unlock-kinds">
          {KINDS.map(kind => {
            const offered = setup.masterCharactersOffered || kind === 'pin' || kind === 'pattern';
            return (
              <Button
                key={kind}
                type="button"
                variant="secondary"
                className="self-start"
                data-kind={kind}
                disabled={!offered}
                onClick={() => setup.choose(kind)}
              >
                {t.kinds[kind]}
              </Button>
            );
          })}
          {!setup.masterCharactersOffered && (
            <p className="text-[12px] text-landing-fg-faint">{t.masterTooShort}</p>
          )}
        </div>
      );
    case 'enter':
    case 'confirm': {
      const confirming = step.kind === 'confirm';
      const take = confirming ? setup.confirm : setup.enter;
      const problem = step.kind === 'enter' ? step.problem : null;
      return (
        <div
          className="flex flex-col gap-3"
          data-testid="quick-unlock-entry"
          data-state={step.kind}
        >
          <p className="text-[13px] text-landing-fg">
            {step.method === 'pin'
              ? confirming
                ? t.confirmPin
                : t.enterPin
              : confirming
                ? t.confirmPattern
                : t.drawPattern}
          </p>
          {step.method === 'pin' ? (
            <PinEntry label={confirming ? t.confirmPin : t.enterPin} onNext={take} />
          ) : (
            <PatternPad locale={LANGUAGE} hideLine={setup.hideLine} onComplete={take} />
          )}
          {!isNil(problem) && (
            <span role="alert" data-state={problem} className="text-[12px] text-error">
              {t.problems[problem]}
            </span>
          )}
        </div>
      );
    }
    case 'done':
      return <Alert type="success" message={t.done} data-testid="quick-unlock-done" />;
    default:
      return null;
  }
});

/** This device's quick unlock of the vault: what it is, setting it up again, its lifetime, off. */
export const QuickUnlockPanel = observer(
  ({ create }: { readonly create: () => QuickUnlockSetup }) => {
    const t = keysT.quick;
    const [setup, setSetup] = useState(create);
    const [settingUp, setSettingUp] = useState(false);
    const { enabled } = setup;
    return (
      <PanelSection title={t.title}>
        <div className="flex flex-col gap-4" data-testid="quick-unlock-panel">
          <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
          <p
            className="text-[13px] text-landing-fg"
            data-testid="quick-unlock-status"
            data-state={enabled ?? 'off'}
          >
            {isNil(enabled) ? t.off : t.on[enabled]}
          </p>
          {settingUp ? (
            <SetupSteps setup={setup} />
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                data-testid="quick-unlock-set-up"
                onClick={() => {
                  setSetup(create());
                  setSettingUp(true);
                }}
              >
                {isNil(enabled) ? t.setUp : t.change}
              </Button>
              {!isNil(enabled) && (
                <Button type="button" variant="secondary" onClick={setup.switchOff}>
                  {t.switchOff}
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-landing-fg">{t.lifetime}</span>
            <RadioGroup<string>
              optionType="button"
              options={QUICK_LIFETIME_CHOICES.map(ms => ({
                label: t.hours(ms / HOUR_MS),
                value: String(ms),
              }))}
              value={String(setup.lifetimeMs)}
              onChange={value => setup.setLifetime(Number(value) as Milliseconds)}
            />
          </div>
          <Checkbox checked={setup.hideLine} onCheckedChange={setup.setHideLine}>
            {t.hideLine}
          </Checkbox>
        </div>
      </PanelSection>
    );
  }
);
