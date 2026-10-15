import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { Button } from '@frozik/components/ui/Button';
import { CardFrame } from '@frozik/components/ui/CardFrame';
import { Spinner } from '@frozik/components/ui/Spinner';
import type { TQuickEntryProblem, TQuickPrompt } from '@frozik/vault-app/keys/domain/quick-code';
import type { QuickLock } from '@frozik/vault-app/session/application/QuickLock';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { PatternPad } from '../pattern-pad/PatternPad';
import { PinPad } from '../pin-pad/PinPad';
import { keysT } from '../texts/keys';
import { LANGUAGE } from '../texts/language';

/**
 * A quick lock's one try: the PIN pad, the four characters or the pattern,
 * and always the way to the master password instead.
 */
export const QuickUnlockScreen = observer(
  ({
    vault,
    quick,
    prompt,
    unlocking,
    onUseMaster,
    onLockCompletely,
  }: {
    readonly vault: IKnownVault;
    readonly quick: Pick<QuickLock, 'attempt'>;
    readonly prompt: TQuickPrompt;
    readonly unlocking: boolean;
    readonly onUseMaster: () => void;
    /** No key left behind the code: only the master password opens the vault again. */
    readonly onLockCompletely: () => void;
  }) => {
    const t = keysT.quickScreen;
    const [problem, setProblem] = useState<TQuickEntryProblem | null>(null);
    const [characters, setCharacters] = useState('');
    const attempt = useEventCallback((entry: string | readonly number[]) => {
      setProblem(quick.attempt(entry));
    });
    const submitCharacters = useEventCallback(() => {
      if (characters !== '') {
        attempt(characters);
        setCharacters('');
      }
    });

    return (
      <CardFrame
        data-testid="quick-unlock"
        className="flex max-w-[480px] flex-col items-center gap-5 p-6"
      >
        <h2 className="text-[20px] font-medium text-landing-fg">{vault.name}</h2>
        <p className="text-[14px] text-landing-fg-dim">{t[prompt.kind]}</p>
        {prompt.kind === 'pin' && (
          <PinPad
            length={prompt.digits}
            locale={LANGUAGE}
            disabled={unlocking}
            onComplete={attempt}
          />
        )}
        {prompt.kind === 'pattern' && (
          <PatternPad
            locale={LANGUAGE}
            hideLine={prompt.hideLine}
            disabled={unlocking}
            onComplete={attempt}
          />
        )}
        {(prompt.kind === 'first-four' || prompt.kind === 'last-four') && (
          <div className="flex items-center gap-3">
            <SecretEditor
              aria-label={t[prompt.kind]}
              autoComplete="off"
              value={characters}
              onValueChange={setCharacters}
              onEnter={submitCharacters}
              disabled={unlocking}
              locale={LANGUAGE}
            />
            <Button
              type="button"
              disabled={characters === '' || unlocking}
              onClick={submitCharacters}
            >
              {t.submit}
            </Button>
          </div>
        )}
        {unlocking && <Spinner />}
        {!isNil(problem) && (
          <span role="alert" data-state={problem} className="text-[13px] text-error">
            {keysT.quick.problems[problem]}
          </span>
        )}
        <p className="text-[12px] text-landing-fg-faint">{t.oneTry}</p>
        <button
          type="button"
          data-testid="use-master-password"
          className="text-[13px] text-landing-fg-dim underline"
          onClick={onUseMaster}
        >
          {t.useMaster}
        </button>
        <button
          type="button"
          data-testid="lock-completely"
          className="text-[13px] text-landing-fg-dim underline"
          onClick={onLockCompletely}
        >
          {t.lockCompletely}
        </button>
      </CardFrame>
    );
  }
);
