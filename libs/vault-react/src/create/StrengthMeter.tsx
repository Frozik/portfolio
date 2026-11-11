import { cn } from '@frozik/components/components/cn';
import { memo } from 'react';

import type {
  IPasswordStrength,
  TPasswordAdvice,
} from '@frozik/vault-app/keys/domain/master-password';
import { isWeak } from '@frozik/vault-app/keys/domain/master-password';
import { vaultT } from '../texts/vault';

const SEGMENTS = [0, 1, 2, 3] as const;

/** The verdict's colour: a very weak password in red, a weak or fair one in yellow, a strong one plain. */
function verdictClass(strength: IPasswordStrength): string {
  if (strength.score === 0) {
    return 'text-error';
  }
  return isWeak(strength) ? 'text-warning' : 'text-landing-fg-dim';
}

/** The zxcvbn verdict: a bar, its word and the offline attack time, and for a weak password the warning and what it lacks. */
export const StrengthMeter = memo(
  ({
    strength,
    advice,
  }: {
    readonly strength: IPasswordStrength;
    readonly advice: readonly TPasswordAdvice[];
  }) => {
    const t = vaultT.create.strength;
    const weak = isWeak(strength);
    return (
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <div className="flex gap-1" aria-hidden="true">
          {SEGMENTS.map(segment => (
            <span
              key={segment}
              className={cn(
                'h-1 flex-1 rounded-full',
                segment < strength.score
                  ? weak
                    ? 'bg-warning'
                    : 'bg-success'
                  : 'bg-landing-border-soft'
              )}
            />
          ))}
        </div>
        <span data-score={strength.score} className={cn('text-[12px]', verdictClass(strength))}>
          {t.label}: {t.scores[strength.score]}. {t.crackTime(strength.offlineCrackTime)}
        </span>
        {weak && <span className="text-[12px] text-landing-fg-dim">{t.weak}</span>}
        {advice.length > 0 && (
          <div className="flex flex-col text-[12px] text-landing-fg-dim">
            <span>{t.adviceTitle}</span>
            <ul className="list-disc pl-4" data-testid="strength-advice">
              {advice.map(item => (
                <li key={item} data-advice={item}>
                  {t.advice[item]}
                </li>
              ))}
            </ul>
          </div>
        )}
        {strength.warning !== null && (
          <span className="text-[12px] text-landing-fg-faint">{strength.warning}</span>
        )}
      </div>
    );
  }
);
